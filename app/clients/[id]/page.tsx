'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Building2, FileText, Upload,
  AlertCircle, ArrowLeft, Eye, File, FileSpreadsheet,
  Image, FileType, RotateCcw, Check, X,
  Brain, Sparkles, Download, Send
} from 'lucide-react';
import {
  getClientById, getDocumentsByClient,
  getClientStats, formatFileSize, getDocumentTypeLabel,
  getStatusColor, getStatusLabel, UploadedDocument
} from '@/lib/clientData';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function getFileIcon(fileType: string) {
  switch (fileType) {
    case 'PDF': return <FileText className="w-5 h-5 text-red-500" />;
    case 'EXCEL': return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
    case 'WORD': return <FileType className="w-5 h-5 text-blue-600" />;
    case 'IMAGE': return <Image className="w-5 h-5 text-purple-500" />;
    default: return <File className="w-5 h-5 text-gray-500" />;
  }
}

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.id as string;
  
  const client = getClientById(clientId);
  const documents = getDocumentsByClient(clientId);
  const stats = client ? getClientStats(clientId) : null;
  
  const [activeTab, setActiveTab] = useState<'documents' | 'bookings' | 'reports'>('documents');
  const [selectedDocument, setSelectedDocument] = useState<UploadedDocument | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    console.log('Dropped files:', files);
    
    // Simulate processing
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      alert(`${files.length} dokument uppladdade! AI-agenten börjar analysera...`);
    }, 2000);
  }, []);

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
          <p className="text-aifm-charcoal/60">Klienten hittades inte</p>
          <Link href="/clients" className="text-aifm-gold hover:underline mt-2 inline-block">
            ← Tillbaka till klienter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="w-full px-6 lg:px-12 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/clients" 
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-aifm-charcoal/60" />
              </Link>
              <div>
                <h1 className="text-xl font-medium text-aifm-charcoal">{client.name}</h1>
                <p className="text-sm text-aifm-charcoal/60">{client.orgNumber} • {client.industry}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="btn-outline py-2 px-4 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Exportera
              </button>
              <button className="btn-primary py-2 px-4 flex items-center gap-2">
                <Send className="w-4 h-4" />
                Skicka rapport
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-6 lg:px-12 py-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Dokument</p>
            <p className="text-2xl font-medium text-aifm-charcoal">{stats?.total || 0}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Väntar</p>
            <p className="text-2xl font-medium text-amber-600">{stats?.pending || 0}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Bearbetas</p>
            <p className="text-2xl font-medium text-blue-600">{stats?.processing || 0}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Bokfört</p>
            <p className="text-2xl font-medium text-green-600">{stats?.booked || 0}</p>
          </div>
          <div className="bg-gradient-to-br from-aifm-gold to-aifm-gold/80 rounded-xl p-5 text-white">
            <p className="text-xs text-white/70 uppercase tracking-wider mb-1">AI Precision</p>
            <p className="text-2xl font-medium">{stats ? (stats.avgConfidence * 100).toFixed(0) : 0}%</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Document Upload & List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                relative bg-white rounded-2xl border-2 border-dashed p-8 text-center transition-all
                ${isDragging 
                  ? 'border-aifm-gold bg-aifm-gold/5 scale-[1.02]' 
                  : 'border-gray-200 hover:border-aifm-gold/50'
                }
                ${processing ? 'pointer-events-none opacity-70' : ''}
              `}
            >
              {processing ? (
                <div className="py-8">
                  <div className="w-16 h-16 mx-auto mb-4 relative">
                    <div className="absolute inset-0 border-4 border-aifm-gold/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-aifm-gold border-t-transparent rounded-full animate-spin"></div>
                    <Brain className="w-8 h-8 text-aifm-gold absolute inset-0 m-auto" />
                  </div>
                  <p className="text-lg font-medium text-aifm-charcoal mb-2">AI analyserar dokument...</p>
                  <p className="text-sm text-aifm-charcoal/60">Klassificerar typ, extraherar data och föreslår bokföring</p>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 bg-aifm-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-aifm-gold" />
                  </div>
                  <p className="text-lg font-medium text-aifm-charcoal mb-2">
                    Släpp dokument här eller klicka för att ladda upp
                  </p>
                  <p className="text-sm text-aifm-charcoal/60 mb-4">
                    PDF, Word, Excel, bilder - AI:n analyserar och bokför automatiskt
                  </p>
                  <div className="flex items-center justify-center gap-4 text-xs text-aifm-charcoal/40">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      GPT-4 Vision
                    </span>
                    <span>•</span>
                    <span>Max 50 MB</span>
                    <span>•</span>
                    <span>Auto-klassificering</span>
                  </div>
                </>
              )}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="border-b border-gray-100">
                <nav className="flex">
                  {(['documents', 'bookings', 'reports'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`
                        flex-1 px-6 py-4 text-sm font-medium uppercase tracking-wide transition-colors
                        ${activeTab === tab
                          ? 'text-aifm-gold border-b-2 border-aifm-gold bg-aifm-gold/5'
                          : 'text-aifm-charcoal/60 hover:text-aifm-charcoal hover:bg-gray-50'
                        }
                      `}
                    >
                      {tab === 'documents' ? 'Dokument' : tab === 'bookings' ? 'Bokföringar' : 'Rapporter'}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Document List */}
              {activeTab === 'documents' && (
                <div className="divide-y divide-gray-50">
                  {documents.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
                      <p className="text-aifm-charcoal/60">Inga dokument uppladdade ännu</p>
                    </div>
                  ) : (
                    documents.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDocument(doc)}
                        className={`
                          p-4 cursor-pointer transition-colors
                          ${selectedDocument?.id === doc.id 
                            ? 'bg-aifm-gold/5' 
                            : 'hover:bg-gray-50'
                          }
                        `}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            {getFileIcon(doc.fileType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-aifm-charcoal truncate">{doc.fileName}</p>
                              {doc.confidence && doc.confidence >= 0.9 && (
                                <Sparkles className="w-4 h-4 text-aifm-gold flex-shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-aifm-charcoal/50">
                                {formatFileSize(doc.fileSize)}
                              </span>
                              <span className="text-xs text-aifm-charcoal/30">•</span>
                              <span className="text-xs text-aifm-charcoal/50">
                                {formatShortDate(doc.uploadedAt)}
                              </span>
                              {doc.documentType && (
                                <>
                                  <span className="text-xs text-aifm-charcoal/30">•</span>
                                  <span className="text-xs text-aifm-charcoal/50">
                                    {getDocumentTypeLabel(doc.documentType)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {doc.confidence && (
                              <div className="text-right">
                                <p className="text-xs text-aifm-charcoal/50">Precision</p>
                                <p className={`text-sm font-medium ${
                                  doc.confidence >= 0.9 ? 'text-green-600' :
                                  doc.confidence >= 0.7 ? 'text-amber-600' :
                                  'text-red-600'
                                }`}>
                                  {(doc.confidence * 100).toFixed(0)}%
                                </p>
                              </div>
                            )}
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(doc.status)}`}>
                              {getStatusLabel(doc.status)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'bookings' && (
                <div className="p-6 text-center">
                  <RotateCcw className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
                  <p className="text-aifm-charcoal/60">Bokföringshistorik visas här</p>
                </div>
              )}

              {activeTab === 'reports' && (
                <div className="p-6 text-center">
                  <FileText className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
                  <p className="text-aifm-charcoal/60">Rapporter och sammanställningar</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Document Details / AI Analysis */}
          <div className="space-y-6">
            {/* Company Info Card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider mb-4">Företagsinfo</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Org.nummer</p>
                  <p className="text-sm font-medium text-aifm-charcoal">{client.orgNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Bolagsform</p>
                  <p className="text-sm font-medium text-aifm-charcoal">{client.type}</p>
                </div>
                <div>
                  <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Bokföringsmetod</p>
                  <p className="text-sm font-medium text-aifm-charcoal">
                    {client.accountingMethod === 'ACCRUAL' ? 'Faktureringsmetoden' : 'Kontantmetoden'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Räkenskapsår</p>
                  <p className="text-sm font-medium text-aifm-charcoal">{client.fiscalYearEnd}</p>
                </div>
                <div>
                  <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Bank</p>
                  <p className="text-sm font-medium text-aifm-charcoal">{client.bankName}</p>
                </div>
              </div>
            </div>

            {/* Selected Document Details */}
            {selectedDocument ? (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">
                      AI-Analys
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedDocument.status)}`}>
                      {getStatusLabel(selectedDocument.status)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      {getFileIcon(selectedDocument.fileType)}
                    </div>
                    <div>
                      <p className="font-medium text-aifm-charcoal">{selectedDocument.fileName}</p>
                      <p className="text-xs text-aifm-charcoal/50">
                        {formatFileSize(selectedDocument.fileSize)} • {formatDate(selectedDocument.uploadedAt)}
                      </p>
                    </div>
                  </div>

                  {selectedDocument.confidence && (
                    <div className="flex items-center gap-2 p-3 bg-aifm-gold/5 rounded-lg">
                      <Brain className="w-5 h-5 text-aifm-gold" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-aifm-charcoal">
                          {(selectedDocument.confidence * 100).toFixed(0)}% precision
                        </p>
                        <p className="text-xs text-aifm-charcoal/60">
                          {selectedDocument.documentType ? getDocumentTypeLabel(selectedDocument.documentType) : 'Analyseras...'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Extracted Data */}
                {selectedDocument.extractedData && (
                  <div className="p-6 border-b border-gray-100">
                    <h4 className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-3">
                      Extraherad data
                    </h4>
                    <div className="space-y-2">
                      {selectedDocument.extractedData.vendor && (
                        <div className="flex justify-between">
                          <span className="text-sm text-aifm-charcoal/60">Leverantör</span>
                          <span className="text-sm font-medium text-aifm-charcoal">{selectedDocument.extractedData.vendor}</span>
                        </div>
                      )}
                      {selectedDocument.extractedData.customer && (
                        <div className="flex justify-between">
                          <span className="text-sm text-aifm-charcoal/60">Kund</span>
                          <span className="text-sm font-medium text-aifm-charcoal">{selectedDocument.extractedData.customer}</span>
                        </div>
                      )}
                      {selectedDocument.extractedData.invoiceNumber && (
                        <div className="flex justify-between">
                          <span className="text-sm text-aifm-charcoal/60">Fakturanr</span>
                          <span className="text-sm font-medium text-aifm-charcoal">{selectedDocument.extractedData.invoiceNumber}</span>
                        </div>
                      )}
                      {selectedDocument.extractedData.date && (
                        <div className="flex justify-between">
                          <span className="text-sm text-aifm-charcoal/60">Datum</span>
                          <span className="text-sm font-medium text-aifm-charcoal">{selectedDocument.extractedData.date}</span>
                        </div>
                      )}
                      {selectedDocument.extractedData.amount && (
                        <div className="flex justify-between">
                          <span className="text-sm text-aifm-charcoal/60">Belopp</span>
                          <span className="text-sm font-medium text-aifm-charcoal">
                            {formatCurrency(selectedDocument.extractedData.amount)}
                          </span>
                        </div>
                      )}
                      {selectedDocument.extractedData.vat && (
                        <div className="flex justify-between">
                          <span className="text-sm text-aifm-charcoal/60">Moms ({selectedDocument.extractedData.vatRate}%)</span>
                          <span className="text-sm font-medium text-aifm-charcoal">
                            {formatCurrency(selectedDocument.extractedData.vat)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Booking Entry */}
                {selectedDocument.bookingEntry && (
                  <div className="p-6 border-b border-gray-100">
                    <h4 className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-3">
                      Bokföringsförslag
                    </h4>
                    <div className="space-y-2 font-mono text-sm">
                      {selectedDocument.bookingEntry.entries.map((entry, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                          <span className="text-aifm-charcoal/70">
                            {entry.account} {entry.accountName}
                          </span>
                          <div className="flex gap-4">
                            <span className={entry.debit > 0 ? 'text-aifm-charcoal' : 'text-transparent'}>
                              {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                            </span>
                            <span className={entry.credit > 0 ? 'text-aifm-charcoal' : 'text-transparent'}>
                              {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Review Note */}
                {selectedDocument.reviewNote && (
                  <div className="p-6 bg-amber-50 border-b border-amber-100">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">Kräver granskning</p>
                        <p className="text-sm text-amber-700 mt-1">{selectedDocument.reviewNote}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="p-6">
                  <div className="flex gap-2">
                    {selectedDocument.status === 'NEEDS_REVIEW' && (
                      <>
                        <button className="flex-1 btn-primary py-2 flex items-center justify-center gap-2">
                          <Check className="w-4 h-4" />
                          Godkänn
                        </button>
                        <button className="btn-outline py-2 px-4">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {selectedDocument.status === 'CLASSIFIED' && (
                      <button className="flex-1 btn-primary py-2 flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" />
                        Bokför
                      </button>
                    )}
                    {selectedDocument.status === 'BOOKED' && (
                      <button className="flex-1 btn-outline py-2 flex items-center justify-center gap-2">
                        <Eye className="w-4 h-4" />
                        Visa verifikation
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <Brain className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
                <p className="text-aifm-charcoal/60">Välj ett dokument för att se AI-analysen</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

