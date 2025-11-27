'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { 
  Upload, FileText, CheckCircle2, Trash2, Eye,
  File, FileSpreadsheet, FileImage, AlertCircle, Sparkles,
  ArrowRight, RotateCcw, X, ZoomIn
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

interface UploadedDocument {
  id: string;
  name: string;
  size: string;
  type: string;
  status: 'uploading' | 'analyzing' | 'classified' | 'needs_review' | 'error';
  uploadedAt: Date;
  aiClassification?: {
    category: string;
    account: string;
    amount?: string;
    supplier?: string;
    date?: string;
    confidence: number;
  };
  thumbnail?: string;
}

// Mock uploaded documents
const mockDocuments: UploadedDocument[] = [
  {
    id: '1',
    name: 'Faktura_Telia_Nov2024.pdf',
    size: '245 KB',
    type: 'pdf',
    status: 'classified',
    uploadedAt: new Date('2024-11-25'),
    aiClassification: {
      category: 'Telefonkostnad',
      account: '6212 - Telefon och internet',
      amount: '2 450 SEK',
      supplier: 'Telia Sverige AB',
      date: '2024-11-20',
      confidence: 98,
    }
  },
  {
    id: '2',
    name: 'Kvitto_SJ_Resa.jpg',
    size: '1.2 MB',
    type: 'jpg',
    status: 'classified',
    uploadedAt: new Date('2024-11-24'),
    aiClassification: {
      category: 'Resekostnad',
      account: '5810 - Biljetter',
      amount: '1 890 SEK',
      supplier: 'SJ AB',
      date: '2024-11-22',
      confidence: 95,
    }
  },
  {
    id: '3',
    name: 'Hyresfaktura_Dec.pdf',
    size: '156 KB',
    type: 'pdf',
    status: 'needs_review',
    uploadedAt: new Date('2024-11-23'),
    aiClassification: {
      category: 'Lokalkostnad',
      account: '5010 - Lokalhyra',
      amount: '45 000 SEK',
      supplier: 'Vasakronan AB',
      date: '2024-12-01',
      confidence: 72,
    }
  },
  {
    id: '4',
    name: 'Konsultfaktura_Tech.pdf',
    size: '890 KB',
    type: 'pdf',
    status: 'analyzing',
    uploadedAt: new Date('2024-11-25'),
  },
  {
    id: '5',
    name: 'Leverantörsfaktura_2024-1847.pdf',
    size: '324 KB',
    type: 'pdf',
    status: 'classified',
    uploadedAt: new Date('2024-11-22'),
    aiClassification: {
      category: 'Inköp varor',
      account: '4010 - Inköp varor',
      amount: '12 500 SEK',
      supplier: 'Office Depot AB',
      date: '2024-11-18',
      confidence: 94,
    }
  },
];

function getFileIcon(type: string) {
  switch (type) {
    case 'pdf':
      return <FileText className="w-6 h-6 text-red-500" />;
    case 'xlsx':
    case 'xls':
      return <FileSpreadsheet className="w-6 h-6 text-green-600" />;
    case 'jpg':
    case 'png':
    case 'jpeg':
      return <FileImage className="w-6 h-6 text-blue-500" />;
    default:
      return <File className="w-6 h-6 text-gray-500" />;
  }
}

function getStatusBadge(status: UploadedDocument['status']) {
  switch (status) {
    case 'uploading':
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Laddar upp...
        </span>
      );
    case 'analyzing':
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-aifm-gold/20 text-aifm-gold text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          AI analyserar...
        </span>
      );
    case 'classified':
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Klassificerad
        </span>
      );
    case 'needs_review':
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
          <AlertCircle className="w-3.5 h-3.5" />
          Behöver granskas
        </span>
      );
    case 'error':
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
          <X className="w-3.5 h-3.5" />
          Fel
        </span>
      );
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export default function AccountingUploadPage() {
  const [documents, setDocuments] = useState<UploadedDocument[]>(mockDocuments);
  const [isDragging, setIsDragging] = useState(false);
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

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFiles = (files: File[]) => {
    files.forEach(file => {
      const newDoc: UploadedDocument = {
        id: `temp-${Date.now()}-${file.name}`,
        name: file.name,
        size: formatFileSize(file.size),
        type: file.name.split('.').pop() || 'unknown',
        status: 'uploading',
        uploadedAt: new Date(),
      };
      
      setDocuments(prev => [newDoc, ...prev]);

      // Simulate upload then AI analysis
      setTimeout(() => {
        setDocuments(prev => 
          prev.map(doc => 
            doc.id === newDoc.id 
              ? { ...doc, status: 'analyzing' as const }
              : doc
          )
        );

        // Simulate AI classification
        setTimeout(() => {
          const categories = [
            { category: 'Kontorsmaterial', account: '6100 - Kontorsmaterial', confidence: 92 },
            { category: 'Resekostnad', account: '5810 - Biljetter', confidence: 88 },
            { category: 'Telefonkostnad', account: '6212 - Telefon och internet', confidence: 95 },
            { category: 'Konsulttjänster', account: '6550 - Konsultarvoden', confidence: 85 },
          ];
          const randomCategory = categories[Math.floor(Math.random() * categories.length)];

          setDocuments(prev => 
            prev.map(doc => 
              doc.id === newDoc.id 
                ? { 
                    ...doc, 
                    status: randomCategory.confidence > 90 ? 'classified' as const : 'needs_review' as const,
                    aiClassification: {
                      ...randomCategory,
                      amount: `${Math.floor(Math.random() * 50000 + 500)} SEK`,
                      supplier: 'Okänd leverantör',
                      date: new Date().toISOString().split('T')[0],
                    }
                  }
                : doc
            )
          );
        }, 2500);
      }, 1500);
    });
  };

  const handleDelete = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const handleApprove = (id: string) => {
    setDocuments(prev => 
      prev.map(doc => 
        doc.id === id 
          ? { ...doc, status: 'classified' as const }
          : doc
      )
    );
  };

  const classifiedCount = documents.filter(d => d.status === 'classified').length;
  const needsReviewCount = documents.filter(d => d.status === 'needs_review').length;
  const analyzingCount = documents.filter(d => d.status === 'analyzing' || d.status === 'uploading').length;

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-aifm-charcoal/40 mb-2">
          <Link href="/accounting" className="hover:text-aifm-gold transition-colors">Bokföring</Link>
          <span>/</span>
          <span className="text-aifm-charcoal">Ladda upp material</span>
        </div>
        <h1 className="text-2xl font-medium text-aifm-charcoal uppercase tracking-wider mb-2">
          Ladda upp material
        </h1>
        <p className="text-aifm-charcoal/60">
          Ladda upp kvitton, fakturor och andra underlag. AI:n analyserar och klassificerar automatiskt.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-aifm-gold/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-aifm-gold" />
            </div>
            <div>
              <p className="text-2xl font-medium text-aifm-charcoal">{documents.length}</p>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Totalt</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-medium text-aifm-charcoal">{classifiedCount}</p>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Klassificerade</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-medium text-aifm-charcoal">{needsReviewCount}</p>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Behöver granskas</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-aifm-gold/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-aifm-gold" />
            </div>
            <div>
              <p className="text-2xl font-medium text-aifm-charcoal">{analyzingCount}</p>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Analyseras</p>
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
          accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="p-12 text-center">
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
          <div className="flex items-center justify-center gap-2 text-xs text-aifm-charcoal/40">
            <Sparkles className="w-4 h-4 text-aifm-gold" />
            <span>AI analyserar och klassificerar automatiskt dina underlag</span>
          </div>
          <p className="text-xs text-aifm-charcoal/30 mt-4">
            Stödda format: PDF, JPG, PNG, Excel, Word
          </p>
        </div>
      </div>

      {/* Document List */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-medium text-aifm-charcoal/60 uppercase tracking-wider">
            Uppladdade underlag
          </h2>
          <Link 
            href="/accounting/bookkeeping"
            className="text-sm text-aifm-gold hover:text-aifm-gold/80 flex items-center gap-1"
          >
            Gå till bokföring <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {documents.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-aifm-charcoal/60">Inga underlag uppladdade ännu</p>
              <p className="text-sm text-aifm-charcoal/40 mt-1">
                Dra och släpp filer ovan för att börja
              </p>
            </div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start gap-4">
                  {/* File Icon */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                    {getFileIcon(doc.type)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-medium text-aifm-charcoal truncate">{doc.name}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-aifm-charcoal/50">
                          <span>{doc.size}</span>
                          <span>•</span>
                          <span>{formatDate(doc.uploadedAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(doc.status)}
                      </div>
                    </div>

                    {/* AI Classification */}
                    {doc.aiClassification && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4 text-aifm-gold" />
                          <span className="text-xs font-medium text-aifm-charcoal/70">AI-klassificering</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            doc.aiClassification.confidence >= 90 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {doc.aiClassification.confidence}% säkerhet
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-aifm-charcoal/40">Kategori</p>
                            <p className="text-aifm-charcoal font-medium">{doc.aiClassification.category}</p>
                          </div>
                          <div>
                            <p className="text-xs text-aifm-charcoal/40">Konto</p>
                            <p className="text-aifm-charcoal font-medium">{doc.aiClassification.account}</p>
                          </div>
                          <div>
                            <p className="text-xs text-aifm-charcoal/40">Belopp</p>
                            <p className="text-aifm-charcoal font-medium">{doc.aiClassification.amount}</p>
                          </div>
                          <div>
                            <p className="text-xs text-aifm-charcoal/40">Leverantör</p>
                            <p className="text-aifm-charcoal font-medium">{doc.aiClassification.supplier}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {doc.status === 'needs_review' && (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(doc.id)}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Godkänn
                        </button>
                        <button
                          onClick={() => setSelectedDoc(doc)}
                          className="px-3 py-1.5 bg-gray-100 text-aifm-charcoal text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Granska
                        </button>
                        <button
                          className="px-3 py-1.5 bg-gray-100 text-aifm-charcoal text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Analysera igen
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    title="Ta bort"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedDoc(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-medium text-aifm-charcoal">{selectedDoc.name}</h3>
              <button onClick={() => setSelectedDoc(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <div className="aspect-[4/3] bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                <div className="text-center">
                  <ZoomIn className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Förhandsgranskning av dokument</p>
                </div>
              </div>
              {selectedDoc.aiClassification && (
                <div className="space-y-3">
                  <h4 className="font-medium text-aifm-charcoal">Redigera klassificering</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-aifm-charcoal/60 block mb-1">Kategori</label>
                      <input 
                        type="text" 
                        defaultValue={selectedDoc.aiClassification.category}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-aifm-charcoal/60 block mb-1">Konto</label>
                      <input 
                        type="text" 
                        defaultValue={selectedDoc.aiClassification.account}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-aifm-charcoal/60 block mb-1">Belopp</label>
                      <input 
                        type="text" 
                        defaultValue={selectedDoc.aiClassification.amount}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-aifm-charcoal/60 block mb-1">Leverantör</label>
                      <input 
                        type="text" 
                        defaultValue={selectedDoc.aiClassification.supplier}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <button 
                      onClick={() => setSelectedDoc(null)}
                      className="px-4 py-2 text-aifm-charcoal/70 hover:bg-gray-100 rounded-lg text-sm"
                    >
                      Avbryt
                    </button>
                    <button 
                      onClick={() => {
                        handleApprove(selectedDoc.id);
                        setSelectedDoc(null);
                      }}
                      className="px-4 py-2 bg-aifm-gold text-white rounded-lg text-sm hover:bg-aifm-gold/90"
                    >
                      Spara & Godkänn
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

