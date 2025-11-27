'use client';

import { useState, useRef } from 'react';
import { 
  Upload, FileText, CheckCircle2, Clock, Trash2, 
  File, FileSpreadsheet, FileImage, AlertCircle
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
    summary: 'Årsredovisning för Nordic Ventures I AB för räkenskapsåret 2023. Innehåller balansräkning, resultaträkning och förvaltningsberättelse.'
  },
  {
    id: '2',
    name: 'Fondbestämmelser_v2.pdf',
    size: '856 KB',
    type: 'pdf',
    status: 'completed',
    uploadedAt: new Date('2024-11-18'),
    pages: 28,
    summary: 'Fondbestämmelser för Nordic Ventures I med information om investeringsstrategi, avgifter och utdelningspolicy.'
  },
  {
    id: '3',
    name: 'Due_Diligence_TechCorp.xlsx',
    size: '1.2 MB',
    type: 'xlsx',
    status: 'completed',
    uploadedAt: new Date('2024-11-15'),
    pages: 12,
    summary: 'Due diligence-rapport för potentiell investering i TechCorp AB. Innehåller finansiell analys och riskbedömning.'
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
    summary: 'Kvartalsbokslut Q3 2024 med resultatutveckling, kassaflödesanalys och portföljuppdatering.'
  },
];

function getFileIcon(type: string) {
  switch (type) {
    case 'pdf':
      return <FileText className="w-8 h-8 text-red-500" />;
    case 'xlsx':
    case 'xls':
      return <FileSpreadsheet className="w-8 h-8 text-green-600" />;
    case 'jpg':
    case 'png':
      return <FileImage className="w-8 h-8 text-blue-500" />;
    default:
      return <File className="w-8 h-8 text-gray-500" />;
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
  const [documents, setDocuments] = useState<UploadedDocument[]>(mockDocuments);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
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
      setUploadingFiles(prev => [...prev, newDoc.id]);

      // Simulate processing
      setTimeout(() => {
        setDocuments(prev => 
          prev.map(doc => 
            doc.id === newDoc.id 
              ? { 
                  ...doc, 
                  status: 'completed' as const, 
                  pages: Math.floor(Math.random() * 30) + 5,
                  summary: `Dokumentet "${file.name}" har analyserats och indexerats för Compliance Agent.`
                } 
              : doc
          )
        );
        setUploadingFiles(prev => prev.filter(id => id !== newDoc.id));
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

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-aifm-charcoal uppercase tracking-wider mb-2">
          Ladda upp dokument
        </h1>
        <p className="text-aifm-charcoal/60">
          Ladda upp dokument som Compliance Agent ska kunna söka i och svara på frågor om.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-aifm-gold/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-aifm-gold" />
            </div>
            <div>
              <p className="text-2xl font-medium text-aifm-charcoal">{documents.length}</p>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Totalt antal</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-medium text-aifm-charcoal">{completedCount}</p>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Indexerade</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-medium text-aifm-charcoal">{processingCount}</p>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Bearbetas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div 
        className={`relative mb-8 border-2 border-dashed rounded-2xl transition-all duration-300 
          ${isDragging 
            ? 'border-aifm-gold bg-aifm-gold/5' 
            : 'border-gray-200 bg-white hover:border-aifm-gold/50 hover:bg-gray-50'
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
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="p-16 text-center">
          <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 transition-colors
            ${isDragging ? 'bg-aifm-gold/20' : 'bg-gray-100'}`}>
            <Upload className={`w-10 h-10 ${isDragging ? 'text-aifm-gold' : 'text-gray-400'}`} />
          </div>
          <h3 className="text-xl font-medium text-aifm-charcoal mb-2">
            {isDragging ? 'Släpp filerna här' : 'Dra och släpp filer här'}
          </h3>
          <p className="text-aifm-charcoal/50 mb-4">
            eller klicka för att välja filer
          </p>
          <p className="text-xs text-aifm-charcoal/40">
            Stödda format: PDF, Word, Excel, TXT, CSV
          </p>
        </div>
      </div>

      {/* Document List */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-aifm-charcoal/60 uppercase tracking-wider">
            Uppladdade dokument
          </h2>
        </div>
        <div className="divide-y divide-gray-50">
          {documents.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-aifm-charcoal/60">Inga dokument uppladdade ännu</p>
              <p className="text-sm text-aifm-charcoal/40 mt-1">
                Ladda upp dokument för att börja använda Compliance Agent
              </p>
            </div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                    {getFileIcon(doc.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-medium text-aifm-charcoal truncate">{doc.name}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-aifm-charcoal/50">
                          <span>{doc.size}</span>
                          <span>•</span>
                          <span>{formatDate(doc.uploadedAt)}</span>
                          {doc.pages && (
                            <>
                              <span>•</span>
                              <span>{doc.pages} sidor</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.status === 'processing' ? (
                          <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                            <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            Bearbetar...
                          </span>
                        ) : doc.status === 'completed' ? (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Indexerad
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Fel
                          </span>
                        )}
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Ta bort"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {doc.summary && (
                      <p className="mt-2 text-sm text-aifm-charcoal/60 line-clamp-2">
                        {doc.summary}
                      </p>
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

