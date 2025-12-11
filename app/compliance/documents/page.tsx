'use client';

import { useState, useRef } from 'react';
import { 
  Upload, FileText, CheckCircle2, Clock, Trash2, 
  File, FileSpreadsheet, FileImage, Brain, Shield, Eye,
  Home, Search
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

interface UploadedDocument {
  id: string;
  name: string;
  size: string;
  type: string;
  status: 'processing' | 'completed' | 'error';
  uploadedAt: Date;
  pages?: number;
  summary?: string;
  confidence?: number;
  category?: string;
}

// Mock uploaded documents
const mockDocuments: UploadedDocument[] = [
  {
    id: '1',
    name: 'Årsredovisning_2023.pdf',
    size: '2.4 MB',
    type: 'pdf',
    status: 'completed',
    uploadedAt: new Date('2024-11-20'),
    pages: 45,
    summary: 'Årsredovisning för Nordic Ventures I AB för räkenskapsåret 2023. Innehåller balansräkning, resultaträkning och förvaltningsberättelse.',
    confidence: 98,
    category: 'Finansiellt'
  },
  {
    id: '2',
    name: 'Fondbestämmelser_v2.pdf',
    size: '856 KB',
    type: 'pdf',
    status: 'completed',
    uploadedAt: new Date('2024-11-18'),
    pages: 28,
    summary: 'Fondbestämmelser för Nordic Ventures I med information om investeringsstrategi, avgifter och utdelningspolicy.',
    confidence: 95,
    category: 'Juridiskt'
  },
  {
    id: '3',
    name: 'Due_Diligence_TechCorp.xlsx',
    size: '1.2 MB',
    type: 'xlsx',
    status: 'completed',
    uploadedAt: new Date('2024-11-15'),
    pages: 12,
    summary: 'Due diligence-rapport för potentiell investering i TechCorp AB. Innehåller finansiell analys och riskbedömning.',
    confidence: 92,
    category: 'Due Diligence'
  },
  {
    id: '4',
    name: 'Investeringsavtal_Q4.pdf',
    size: '1.8 MB',
    type: 'pdf',
    status: 'processing',
    uploadedAt: new Date('2024-11-25'),
    category: 'Juridiskt'
  },
  {
    id: '5',
    name: 'Kvartalsbokslut_Q3_2024.pdf',
    size: '3.1 MB',
    type: 'pdf',
    status: 'completed',
    uploadedAt: new Date('2024-10-30'),
    pages: 18,
    summary: 'Kvartalsbokslut Q3 2024 med resultatutveckling, kassaflödesanalys och portföljuppdatering.',
    confidence: 97,
    category: 'Finansiellt'
  },
];

// Tab Button Component
function TabButton({ 
  label, 
  isActive, 
  onClick,
  count
}: { 
  label: string; 
  isActive: boolean; 
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
        isActive
          ? 'bg-white text-aifm-charcoal shadow-sm'
          : 'text-white/70 hover:text-white hover:bg-white/10'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-2 ${isActive ? 'text-aifm-charcoal/50' : 'text-white/50'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// Hero Metric Card
function HeroMetric({ 
  label, 
  value, 
  subValue,
  icon: Icon
}: { 
  label: string; 
  value: string; 
  subValue?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-white/10 rounded-lg">
          <Icon className="w-4 h-4 text-white/70" />
        </div>
        <p className="text-xs text-white/50 uppercase tracking-wider font-medium">{label}</p>
      </div>
      <p className="text-2xl font-semibold text-white">{value}</p>
      {subValue && <p className="text-sm text-white/60 mt-1">{subValue}</p>}
    </div>
  );
}

function getFileIcon(type: string) {
  const iconClass = "w-6 h-6";
  switch (type) {
    case 'pdf':
      return <FileText className={`${iconClass} text-red-500`} />;
    case 'xlsx':
    case 'xls':
      return <FileSpreadsheet className={`${iconClass} text-emerald-600`} />;
    case 'jpg':
    case 'png':
      return <FileImage className={`${iconClass} text-blue-500`} />;
    default:
      return <File className={`${iconClass} text-gray-500`} />;
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export default function ComplianceDocumentsPage() {
  const { selectedCompany } = useCompany();
  const [documents, setDocuments] = useState<UploadedDocument[]>(mockDocuments);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'indexed' | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<UploadedDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = (files: File[]) => {
    files.forEach(file => {
      const newDoc: UploadedDocument = {
        id: `temp-${Date.now()}-${file.name}`,
        name: file.name,
        size: formatFileSize(file.size),
        type: file.name.split('.').pop() || 'unknown',
        status: 'processing',
        uploadedAt: new Date(),
      };
      
      setDocuments(prev => [newDoc, ...prev]);

      // Simulate processing
      setTimeout(() => {
        setDocuments(prev => 
          prev.map(doc => 
            doc.id === newDoc.id 
              ? { 
                  ...doc, 
                  status: 'completed' as const, 
                  pages: Math.floor(Math.random() * 30) + 5,
                  summary: `Dokumentet "${file.name}" har analyserats och indexerats för Compliance Agent.`,
                  confidence: Math.floor(Math.random() * 10) + 90,
                  category: 'Nytt'
                } 
              : doc
          )
        );
      }, 3000);
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDelete = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
    if (selectedDoc?.id === id) setSelectedDoc(null);
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'upload') return matchesSearch && doc.status === 'processing';
    if (activeTab === 'indexed') return matchesSearch && doc.status === 'completed';
    return matchesSearch;
  });

  const completedCount = documents.filter(d => d.status === 'completed').length;
  const processingCount = documents.filter(d => d.status === 'processing').length;
  const totalPages = documents.reduce((sum, d) => sum + (d.pages || 0), 0);

  return (
    <DashboardLayout>
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 px-4 sm:px-6 pt-6 pb-6 mb-8 rounded-2xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Home className="w-4 h-4" />
          <span>/</span>
          <span>Compliance</span>
          <span>/</span>
          <span className="text-white">Dokument</span>
        </div>

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-semibold text-white tracking-tight mb-1">
                Dokumenthantering
              </h1>
              <p className="text-white/50 text-sm lg:text-base">
                AI-driven analys för {selectedCompany.shortName}
              </p>
            </div>
          </div>
        </div>

        {/* Hero Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <HeroMetric 
            label="Totalt dokument"
            value={documents.length.toString()}
            icon={FileText}
          />
          <HeroMetric 
            label="Indexerade"
            value={completedCount.toString()}
            subValue={`${Math.round((completedCount / documents.length) * 100)}% klar`}
            icon={CheckCircle2}
          />
          <HeroMetric 
            label="Bearbetas"
            value={processingCount.toString()}
            icon={Clock}
          />
          <HeroMetric 
            label="Sidor analyserade"
            value={totalPages.toString()}
            icon={Eye}
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1.5 w-fit">
          <TabButton 
            label="Alla" 
            isActive={activeTab === 'all'} 
            onClick={() => setActiveTab('all')}
            count={documents.length}
          />
          <TabButton 
            label="Indexerade" 
            isActive={activeTab === 'indexed'} 
            onClick={() => setActiveTab('indexed')}
            count={completedCount}
          />
          <TabButton 
            label="Bearbetas" 
            isActive={activeTab === 'upload'} 
            onClick={() => setActiveTab('upload')}
            count={processingCount}
          />
        </div>
      </div>

      {/* Main Content - Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Upload + List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upload Area */}
          <div 
            className={`relative rounded-2xl transition-all duration-500 overflow-hidden
              ${isDragging 
                ? 'bg-aifm-gold/5 border-2 border-aifm-gold shadow-xl shadow-aifm-gold/20' 
                : 'bg-white border-2 border-dashed border-gray-200 hover:border-aifm-gold/50 hover:shadow-lg'
              }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            
            <div className="relative p-8 lg:p-10 text-center">
              <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 
                              transition-all duration-500 ${isDragging 
                                ? 'bg-aifm-gold scale-110 shadow-xl shadow-aifm-gold/30' 
                                : 'bg-gray-100'}`}>
                <Upload className={`w-8 h-8 transition-colors duration-500 ${
                  isDragging ? 'text-white' : 'text-gray-400'
                }`} />
              </div>
              
              <h3 className="text-lg font-semibold text-aifm-charcoal mb-1">
                {isDragging ? 'Släpp filerna här' : 'Dra och släpp filer'}
              </h3>
              <p className="text-sm text-aifm-charcoal/50 mb-3">
                eller <span className="text-aifm-gold font-medium cursor-pointer hover:underline">bläddra</span>
              </p>
              
              <div className="flex items-center justify-center gap-2 text-xs text-aifm-charcoal/40">
                <span className="px-2 py-1 bg-gray-100 rounded-full">PDF</span>
                <span className="px-2 py-1 bg-gray-100 rounded-full">Word</span>
                <span className="px-2 py-1 bg-gray-100 rounded-full">Excel</span>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-aifm-charcoal/30 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Sök dokument..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-3 pl-11 pr-4 bg-white border border-gray-200 rounded-xl text-sm
                         placeholder:text-aifm-charcoal/30 focus:outline-none focus:border-aifm-gold/30 
                         focus:ring-2 focus:ring-aifm-gold/10 transition-all"
            />
          </div>

          {/* Document List */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-aifm-charcoal">
                Dokument
              </h2>
              <span className="text-xs text-aifm-charcoal/40">{filteredDocs.length} filer</span>
            </div>
            
            <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
              {filteredDocs.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-aifm-charcoal/60 font-medium">Inga dokument</p>
                  <p className="text-xs text-aifm-charcoal/40 mt-1">Ladda upp för att börja</p>
                </div>
              ) : (
                filteredDocs.map((doc) => (
                  <div 
                    key={doc.id} 
                    className={`group px-5 py-4 cursor-pointer transition-all duration-300 ${
                      selectedDoc?.id === doc.id 
                        ? 'bg-aifm-gold/5 border-l-2 border-aifm-gold' 
                        : 'hover:bg-gray-50/50 border-l-2 border-transparent'
                    }`}
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
                        ${doc.type === 'pdf' ? 'bg-red-50' : 
                          doc.type === 'xlsx' || doc.type === 'xls' ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                        {getFileIcon(doc.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-aifm-charcoal text-sm truncate">
                          {doc.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-aifm-charcoal/50">
                          <span>{doc.size}</span>
                          <span className="w-1 h-1 bg-aifm-charcoal/20 rounded-full" />
                          <span>{formatDate(doc.uploadedAt)}</span>
                        </div>
                      </div>
                      
                      {doc.status === 'processing' ? (
                        <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Detail Panel */}
        <div className="hidden lg:block">
          {selectedDoc ? (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden sticky top-4">
              {/* Header */}
              <div className="p-5 border-b border-gray-100 bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4
                  ${selectedDoc.type === 'pdf' ? 'bg-red-500/20' : 
                    selectedDoc.type === 'xlsx' || selectedDoc.type === 'xls' ? 'bg-emerald-500/20' : 'bg-white/10'}`}>
                  {getFileIcon(selectedDoc.type)}
                </div>
                <h3 className="font-semibold text-white text-sm truncate mb-1">{selectedDoc.name}</h3>
                <p className="text-white/50 text-xs">{selectedDoc.size} • {formatDate(selectedDoc.uploadedAt)}</p>
              </div>

              {/* Content */}
              <div className="p-5 space-y-5">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Status</span>
                  {selectedDoc.status === 'completed' ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Indexerad
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-xs font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      Bearbetas
                    </span>
                  )}
                </div>

                {/* Stats Grid */}
                {selectedDoc.status === 'completed' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-aifm-charcoal/50 mb-1">Sidor</p>
                        <p className="text-lg font-semibold text-aifm-charcoal">{selectedDoc.pages}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-aifm-charcoal/50 mb-1">Konfidens</p>
                        <p className="text-lg font-semibold text-aifm-charcoal">{selectedDoc.confidence}%</p>
                      </div>
                    </div>

                    {selectedDoc.category && (
                      <div>
                        <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-2">Kategori</p>
                        <span className="px-3 py-1.5 bg-aifm-charcoal/5 rounded-full text-sm font-medium text-aifm-charcoal">
                          {selectedDoc.category}
                        </span>
                      </div>
                    )}

                    {selectedDoc.summary && (
                      <div>
                        <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-2">AI-sammanfattning</p>
                        <p className="text-sm text-aifm-charcoal/70 leading-relaxed bg-gray-50 rounded-xl p-4">
                          {selectedDoc.summary}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-aifm-charcoal/70 
                                     bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">
                    <Eye className="w-4 h-4" />
                    Visa
                  </button>
                  <button 
                    onClick={() => handleDelete(selectedDoc.id)}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-red-600 
                               bg-red-50 rounded-xl hover:bg-red-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-8 text-center h-[400px] flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-aifm-charcoal/50 font-medium">Välj ett dokument</p>
              <p className="text-sm text-aifm-charcoal/30 mt-1">Klicka på ett dokument för att se detaljer</p>
            </div>
          )}
        </div>
      </div>

      {/* AI Notice */}
      <div className="mt-8 bg-gradient-to-r from-aifm-charcoal to-aifm-charcoal/90 rounded-2xl p-5 text-white">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-aifm-gold" />
          </div>
          <div>
            <h3 className="font-semibold mb-1 text-sm">AI-driven dokumentanalys</h3>
            <p className="text-xs text-white/70">
              Uppladdade dokument analyseras av GPT Vision för automatisk klassificering och indexering för snabb compliance-sökning.
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Detail Modal */}
      {selectedDoc && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-aifm-charcoal truncate flex-1 mr-4">{selectedDoc.name}</h3>
              <button onClick={() => setSelectedDoc(null)} className="p-2 text-aifm-charcoal/50">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-5">
              {selectedDoc.status === 'completed' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-aifm-charcoal/50 mb-1">Sidor</p>
                      <p className="text-xl font-semibold text-aifm-charcoal">{selectedDoc.pages}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-aifm-charcoal/50 mb-1">Konfidens</p>
                      <p className="text-xl font-semibold text-aifm-charcoal">{selectedDoc.confidence}%</p>
                    </div>
                  </div>
                  {selectedDoc.summary && (
                    <div>
                      <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-2">AI-sammanfattning</p>
                      <p className="text-sm text-aifm-charcoal/70 leading-relaxed bg-gray-50 rounded-xl p-4">
                        {selectedDoc.summary}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-sm text-aifm-charcoal/60">Analyserar dokument...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
