'use client';

// Force dynamic rendering to avoid useSearchParams issues
export const dynamic = 'force-dynamic';

import { useState, useRef, Suspense } from 'react';
import { 
  Upload, FileText, CheckCircle2, Clock, Trash2, 
  File, FileSpreadsheet, FileImage, Brain, Shield, Eye,
  Search, RefreshCw, Download, Filter, BarChart3, Loader2
} from 'lucide-react';

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

// Simple Card components (matching bookkeeping style)
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

function getFileIcon(type: string) {
  const iconClass = "w-5 h-5";
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

function getStatusBadge(status: UploadedDocument['status']) {
  switch (status) {
    case 'completed':
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
          <CheckCircle2 className="w-3 h-3" />
          Indexerad
        </span>
      );
    case 'processing':
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
          <Clock className="w-3 h-3" />
          Bearbetas
        </span>
      );
    case 'error':
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
          <Trash2 className="w-3 h-3" />
          Fel
        </span>
      );
  }
}

export default function ComplianceDocumentsPage() {
  const { selectedCompany } = useCompany();
  const [documents, setDocuments] = useState<UploadedDocument[]>(mockDocuments);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'indexed' | 'processing'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<UploadedDocument | null>(null);
  const [refreshing, setRefreshing] = useState(false);
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

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'processing') return matchesSearch && doc.status === 'processing';
    if (activeTab === 'indexed') return matchesSearch && doc.status === 'completed';
    return matchesSearch;
  });

  const completedCount = documents.filter(d => d.status === 'completed').length;
  const processingCount = documents.filter(d => d.status === 'processing').length;
  const totalPages = documents.reduce((sum, d) => sum + (d.pages || 0), 0);

  return (
    <>
      <div className="p-6 w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light text-gray-900 tracking-tight">
              Dokumenthantering
            </h1>
            <p className="text-gray-500 mt-1">
              AI-driven analys för {selectedCompany.shortName}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Uppdatera"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exportera
            </button>
          </div>
        </div>

        {/* Processing indicator */}
        {processingCount > 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent>
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="text-sm text-blue-700">
                  {processingCount} dokument bearbetas just nu...
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-gray-400">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm">Totalt</span>
              </div>
              <div className="text-2xl font-light text-gray-900">
                {documents.length}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-400">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm">Indexerade</span>
              </div>
              <div className="text-2xl font-light text-gray-900">
                {completedCount}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-400">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-sm">Bearbetas</span>
              </div>
              <div className="text-2xl font-light text-gray-900">
                {processingCount}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-400">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Eye className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Sidor analyserade</span>
              </div>
              <div className="text-2xl font-light text-gray-900">
                {totalPages}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upload Area */}
        <Card>
          <div 
            className={`relative rounded-xl transition-all duration-300 overflow-hidden
              ${isDragging 
                ? 'bg-[#c0a280]/5 border-2 border-[#c0a280] border-dashed' 
                : 'border-2 border-dashed border-gray-200 hover:border-[#c0a280]/50'
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
            
            <div className="p-8 text-center">
              <div className={`w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4 
                              transition-all duration-300 ${isDragging 
                                ? 'bg-[#c0a280] scale-110' 
                                : 'bg-gray-100'}`}>
                <Upload className={`w-7 h-7 transition-colors duration-300 ${
                  isDragging ? 'text-white' : 'text-gray-400'
                }`} />
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                {isDragging ? 'Släpp filerna här' : 'Dra och släpp filer'}
              </h3>
              <p className="text-sm text-gray-500 mb-3">
                eller <span className="text-[#c0a280] font-medium cursor-pointer hover:underline">bläddra</span>
              </p>
              
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <span className="px-2 py-1 bg-gray-100 rounded-full">PDF</span>
                <span className="px-2 py-1 bg-gray-100 rounded-full">Word</span>
                <span className="px-2 py-1 bg-gray-100 rounded-full">Excel</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <Card>
          <CardContent className="p-0">
            <div className="flex border-b border-gray-100">
              {[
                { key: 'all', label: 'Alla', count: documents.length, icon: BarChart3 },
                { key: 'indexed', label: 'Indexerade', count: completedCount, icon: CheckCircle2 },
                { key: 'processing', label: 'Bearbetas', count: processingCount, icon: Clock },
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
                  <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab.key ? 'bg-[#c0a280]/20 text-[#c0a280]' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {tab.count}
                  </span>
                  {activeTab === tab.key && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c0a280] rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Sök dokument..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-0 rounded-lg text-sm
                             focus:bg-white focus:ring-2 focus:ring-[#c0a280]/10 transition-all"
                />
              </div>
              <button className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg flex items-center gap-2 hover:bg-gray-200 transition-colors">
                <Filter className="w-4 h-4" />
                Filter
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content - Master-Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Document List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Dokument</CardTitle>
                <span className="text-xs text-gray-500">{filteredDocs.length} filer</span>
              </CardHeader>
              
              <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                {filteredDocs.length === 0 ? (
                  <div className="p-12 text-center">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">Inga dokument</p>
                    <p className="text-xs text-gray-400 mt-1">Ladda upp för att börja</p>
                  </div>
                ) : (
                  filteredDocs.map((doc) => (
                    <div 
                      key={doc.id} 
                      className={`group px-4 py-3 cursor-pointer transition-all duration-200 ${
                        selectedDoc?.id === doc.id 
                          ? 'bg-[#c0a280]/5 border-l-2 border-[#c0a280]' 
                          : 'hover:bg-gray-50 border-l-2 border-transparent'
                      }`}
                      onClick={() => setSelectedDoc(doc)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                          ${doc.type === 'pdf' ? 'bg-red-50' : 
                            doc.type === 'xlsx' || doc.type === 'xls' ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                          {getFileIcon(doc.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 text-sm truncate">
                            {doc.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                            <span>{doc.size}</span>
                            <span className="w-1 h-1 bg-gray-300 rounded-full" />
                            <span>{formatDate(doc.uploadedAt)}</span>
                            {doc.category && (
                              <>
                                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                <span>{doc.category}</span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {getStatusBadge(doc.status)}
                          {doc.confidence && (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              doc.confidence >= 90 ? 'bg-green-100 text-green-700' :
                              doc.confidence >= 70 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {doc.confidence}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Right: Detail Panel */}
          <div className="hidden lg:block">
            {selectedDoc ? (
              <Card className="sticky top-4">
                {/* Header */}
                <div className="p-5 border-b border-gray-100">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4
                    ${selectedDoc.type === 'pdf' ? 'bg-red-50' : 
                      selectedDoc.type === 'xlsx' || selectedDoc.type === 'xls' ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                    {getFileIcon(selectedDoc.type)}
                  </div>
                  <h3 className="font-medium text-gray-900 text-sm truncate mb-1">{selectedDoc.name}</h3>
                  <p className="text-gray-500 text-xs">{selectedDoc.size} • {formatDate(selectedDoc.uploadedAt)}</p>
                </div>

                {/* Content */}
                <div className="p-5 space-y-5">
                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Status</span>
                    {getStatusBadge(selectedDoc.status)}
                  </div>

                  {/* Stats Grid */}
                  {selectedDoc.status === 'completed' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">Sidor</p>
                          <p className="text-lg font-semibold text-gray-900">{selectedDoc.pages}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">Konfidens</p>
                          <p className="text-lg font-semibold text-gray-900">{selectedDoc.confidence}%</p>
                        </div>
                      </div>

                      {selectedDoc.category && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Kategori</p>
                          <span className="px-3 py-1.5 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
                            {selectedDoc.category}
                          </span>
                        </div>
                      )}

                      {selectedDoc.summary && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">AI-sammanfattning</p>
                          <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-4">
                            {selectedDoc.summary}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {selectedDoc.status === 'processing' && (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 text-[#c0a280] animate-spin mx-auto mb-4" />
                      <p className="text-sm text-gray-500">Analyserar dokument...</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-700 
                                       bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                      <Eye className="w-4 h-4" />
                      Visa
                    </button>
                    <button 
                      onClick={() => handleDelete(selectedDoc.id)}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-red-600 
                                 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="h-[400px] flex flex-col items-center justify-center text-center p-8">
                <FileText className="w-12 h-12 text-gray-300 mb-4" />
                <p className="text-gray-600 font-medium">Välj ett dokument</p>
                <p className="text-sm text-gray-400 mt-1">Klicka på ett dokument för att se detaljer</p>
              </Card>
            )}
          </div>
        </div>

        {/* AI Notice */}
        <Card className="bg-[#c0a280]/10 border-[#c0a280]/20">
          <CardContent>
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-[#c0a280] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-900 font-medium">AI-driven dokumentanalys</p>
                <p className="text-xs text-gray-700 mt-1">
                  Uppladdade dokument analyseras av GPT Vision för automatisk klassificering och indexering för snabb compliance-sökning.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Detail Modal */}
      {selectedDoc && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end" onClick={() => setSelectedDoc(null)}>
          <div className="bg-white rounded-t-3xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 truncate flex-1 mr-4">{selectedDoc.name}</h3>
              <button onClick={() => setSelectedDoc(null)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Status</span>
                {getStatusBadge(selectedDoc.status)}
              </div>
              
              {selectedDoc.status === 'completed' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">Sidor</p>
                      <p className="text-xl font-semibold text-gray-900">{selectedDoc.pages}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">Konfidens</p>
                      <p className="text-xl font-semibold text-gray-900">{selectedDoc.confidence}%</p>
                    </div>
                  </div>
                  {selectedDoc.summary && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">AI-sammanfattning</p>
                      <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-4">
                        {selectedDoc.summary}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 text-[#c0a280] animate-spin mx-auto mb-4" />
                  <p className="text-sm text-gray-500">Analyserar dokument...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
