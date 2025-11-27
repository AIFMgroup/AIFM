'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Upload, FileText, CheckCircle2, Clock, Trash2, 
  File, FileSpreadsheet, FileImage, AlertCircle, Brain, Shield, Eye
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

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
    confidence: 98
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
    confidence: 95
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
    confidence: 92
  },
  {
    id: '4',
    name: 'Investeringsavtal_Q4.pdf',
    size: '1.8 MB',
    type: 'pdf',
    status: 'processing',
    uploadedAt: new Date('2024-11-25'),
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
    confidence: 97
  },
];

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

// Animated Stat Card
function StatCard({ 
  icon: Icon, 
  value, 
  label, 
  color, 
  delay = 0 
}: { 
  icon: React.ElementType; 
  value: number; 
  label: string; 
  color: string;
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (isVisible) {
      const duration = 1000;
      const start = Date.now();
      const animate = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        setAnimatedValue(Math.floor(progress * value));
        if (progress < 1) requestAnimationFrame(animate);
      };
      animate();
    }
  }, [isVisible, value]);

  return (
    <div className={`
      relative group bg-white rounded-2xl p-6 border border-gray-100/50
      transition-all duration-500 ease-out
      hover:shadow-xl hover:shadow-${color}/10 hover:-translate-y-1
      ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
    `}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl bg-${color}/10 flex items-center justify-center
                        group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-6 h-6 text-${color}`} />
        </div>
        <div>
          <p className="text-3xl font-semibold text-aifm-charcoal tracking-tight">{animatedValue}</p>
          <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider font-medium">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function ComplianceDocumentsPage() {
  const [documents, setDocuments] = useState<UploadedDocument[]>(mockDocuments);
  const [isDragging, setIsDragging] = useState(false);
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
                  confidence: Math.floor(Math.random() * 10) + 90
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
  };

  const completedCount = documents.filter(d => d.status === 'completed').length;
  const processingCount = documents.filter(d => d.status === 'processing').length;
  const totalPages = documents.reduce((sum, d) => sum + (d.pages || 0), 0);

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/80 
                          flex items-center justify-center shadow-lg shadow-aifm-charcoal/20">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-aifm-charcoal tracking-tight">
              Dokumenthantering
            </h1>
            <p className="text-sm text-aifm-charcoal/50">
              Ladda upp dokument för AI-analys och compliance-sökning
            </p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        <StatCard 
          icon={FileText} 
          value={documents.length} 
          label="Totalt dokument" 
          color="aifm-gold"
          delay={0}
        />
        <StatCard 
          icon={CheckCircle2} 
          value={completedCount} 
          label="Indexerade" 
          color="emerald-500"
          delay={100}
        />
        <StatCard 
          icon={Clock} 
          value={processingCount} 
          label="Bearbetas" 
          color="amber-500"
          delay={200}
        />
        <StatCard 
          icon={Eye} 
          value={totalPages} 
          label="Sidor analyserade" 
          color="blue-500"
          delay={300}
        />
      </div>

      {/* Upload Area */}
      <div 
        className={`relative mb-10 rounded-2xl transition-all duration-500 overflow-hidden
          ${isDragging 
            ? 'bg-aifm-gold/5 border-2 border-aifm-gold shadow-xl shadow-aifm-gold/20' 
            : 'bg-white border-2 border-dashed border-gray-200 hover:border-aifm-gold/50 hover:shadow-lg'
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" 
               style={{
                 backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
                 backgroundSize: '24px 24px'
               }} />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        
        <div className="relative p-12 lg:p-16 text-center">
          <div className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-6 
                          transition-all duration-500 ${isDragging 
                            ? 'bg-aifm-gold scale-110 shadow-xl shadow-aifm-gold/30' 
                            : 'bg-gray-100'}`}>
            <Upload className={`w-10 h-10 transition-colors duration-500 ${
              isDragging ? 'text-white' : 'text-gray-400'
            }`} />
          </div>
          
          <h3 className="text-xl font-semibold text-aifm-charcoal mb-2">
            {isDragging ? 'Släpp filerna här' : 'Dra och släpp filer här'}
          </h3>
          <p className="text-aifm-charcoal/50 mb-4">
            eller <span className="text-aifm-gold font-medium cursor-pointer hover:underline">bläddra</span> för att välja
          </p>
          
          <div className="flex items-center justify-center gap-4 text-xs text-aifm-charcoal/40">
            <span className="px-3 py-1 bg-gray-100 rounded-full">PDF</span>
            <span className="px-3 py-1 bg-gray-100 rounded-full">Word</span>
            <span className="px-3 py-1 bg-gray-100 rounded-full">Excel</span>
            <span className="px-3 py-1 bg-gray-100 rounded-full">TXT</span>
          </div>
        </div>
      </div>

      {/* AI Processing Notice */}
      <div className="bg-gradient-to-r from-aifm-charcoal to-aifm-charcoal/90 rounded-2xl p-6 mb-8 text-white">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-aifm-gold" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">AI-driven dokumentanalys</h3>
            <p className="text-sm text-white/70">
              Uppladdade dokument analyseras av GPT Vision för automatisk klassificering, 
              extrahering av nyckelinformation och indexering för snabb compliance-sökning.
            </p>
          </div>
        </div>
      </div>

      {/* Document List */}
      <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">
            Uppladdade dokument
          </h2>
          <span className="text-xs text-aifm-charcoal/40">{documents.length} filer</span>
        </div>
        
        <div className="divide-y divide-gray-50">
          {documents.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-6">
                <FileText className="w-10 h-10 text-gray-300" />
              </div>
              <p className="text-aifm-charcoal/60 font-medium">Inga dokument uppladdade ännu</p>
              <p className="text-sm text-aifm-charcoal/40 mt-2">
                Ladda upp dokument för att börja använda Compliance Agent
              </p>
            </div>
          ) : (
            documents.map((doc, index) => (
              <div 
                key={doc.id} 
                className="group px-6 py-5 hover:bg-gray-50/50 transition-all duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-4">
                  {/* File Icon with type background */}
                  <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center
                    ${doc.type === 'pdf' ? 'bg-red-50' : 
                      doc.type === 'xlsx' || doc.type === 'xls' ? 'bg-emerald-50' : 'bg-gray-50'}
                    group-hover:scale-105 transition-transform duration-300`}>
                    {getFileIcon(doc.type)}
                  </div>
                  
                  {/* Document Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h3 className="font-medium text-aifm-charcoal group-hover:text-aifm-gold transition-colors">
                          {doc.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-aifm-charcoal/50">
                          <span>{doc.size}</span>
                          <span className="w-1 h-1 bg-aifm-charcoal/20 rounded-full" />
                          <span>{formatDate(doc.uploadedAt)}</span>
                          {doc.pages && (
                            <>
                              <span className="w-1 h-1 bg-aifm-charcoal/20 rounded-full" />
                              <span>{doc.pages} sidor</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Status & Actions */}
                      <div className="flex items-center gap-3">
                        {doc.status === 'processing' ? (
                          <span className="flex items-center gap-2 px-4 py-2 rounded-full 
                                         bg-amber-100 text-amber-700 text-xs font-medium">
                            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            Analyserar...
                          </span>
                        ) : doc.status === 'completed' ? (
                          <div className="flex items-center gap-2">
                            {doc.confidence && (
                              <span className="text-xs text-aifm-charcoal/40">
                                {doc.confidence}% konfidensgrad
                              </span>
                            )}
                            <span className="flex items-center gap-1.5 px-4 py-2 rounded-full 
                                           bg-emerald-100 text-emerald-700 text-xs font-medium">
                              <CheckCircle2 className="w-4 h-4" />
                              Indexerad
                            </span>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1.5 px-4 py-2 rounded-full 
                                         bg-red-100 text-red-700 text-xs font-medium">
                            <AlertCircle className="w-4 h-4" />
                            Fel
                          </span>
                        )}
                        
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 
                                   rounded-xl transition-all duration-200 opacity-0 group-hover:opacity-100"
                          title="Ta bort"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Summary */}
                    {doc.summary && (
                      <div className="mt-3 p-4 bg-gray-50 rounded-xl">
                        <p className="text-sm text-aifm-charcoal/60 leading-relaxed">
                          {doc.summary}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
