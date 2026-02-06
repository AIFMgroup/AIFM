'use client';

import { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Plus, 
  Link as LinkIcon, 
  Upload, 
  FileText, 
  Trash2, 
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle,
  Search,
  Building2,
  Calendar,
  RefreshCw,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Document {
  id: string;
  title: string;
  source: string;
  sourceType: 'url' | 'pdf' | 'docx' | 'text';
  metadata: {
    documentNumber?: string;
    authority?: string;
    effectiveDate?: string;
    lastUpdated?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Pre-defined Swedish Regulations
// ============================================================================

const RECOMMENDED_REGULATIONS = [
  {
    title: 'Lag om värdepappersfonder (SFS 2004:46)',
    url: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-200446-om-vardepappersfonder_sfs-2004-46/',
    authority: 'Riksdagen',
    category: 'Lagar',
  },
  {
    title: 'Lag om förvaltare av alternativa investeringsfonder (SFS 2013:561)',
    url: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2013561-om-forvaltare-av-alternativa_sfs-2013-561/',
    authority: 'Riksdagen',
    category: 'Lagar',
  },
  {
    title: 'Lag om värdepappersmarknaden (SFS 2007:528)',
    url: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2007528-om-vardepappersmarknaden_sfs-2007-528/',
    authority: 'Riksdagen',
    category: 'Lagar',
  },
  {
    title: 'FFFS 2013:9 - Föreskrifter om värdepappersfonder',
    url: 'https://www.fi.se/sv/vara-register/fffs/sok-fffs/2013/20139/',
    authority: 'Finansinspektionen',
    category: 'Föreskrifter',
  },
  {
    title: 'FFFS 2013:10 - Föreskrifter om förvaltare av alternativa investeringsfonder',
    url: 'https://www.fi.se/sv/vara-register/fffs/sok-fffs/2013/201310/',
    authority: 'Finansinspektionen',
    category: 'Föreskrifter',
  },
];

// ============================================================================
// Components
// ============================================================================

function AddUrlModal({ 
  isOpen, 
  onClose, 
  onSubmit,
  isLoading 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSubmit: (urls: string[]) => Promise<void>;
  isLoading: boolean;
}) {
  const [urls, setUrls] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const urlList = [
      ...selectedPreset,
      ...urls.split('\n').map(u => u.trim()).filter(Boolean),
    ];
    if (urlList.length > 0) {
      await onSubmit(urlList);
      setUrls('');
      setSelectedPreset([]);
    }
  };

  const togglePreset = (url: string) => {
    setSelectedPreset(prev => 
      prev.includes(url) 
        ? prev.filter(u => u !== url)
        : [...prev, url]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#2d2a26]">Lägg till regelverk</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Recommended Regulations */}
          <div>
            <h3 className="text-sm font-medium text-[#2d2a26] mb-3">Rekommenderade regelverk</h3>
            <div className="space-y-2">
              {RECOMMENDED_REGULATIONS.map((reg) => (
                <label
                  key={reg.url}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedPreset.includes(reg.url)
                      ? 'border-[#c0a280] bg-[#c0a280]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPreset.includes(reg.url)}
                    onChange={() => togglePreset(reg.url)}
                    className="mt-1 w-4 h-4 rounded border-gray-300 text-[#c0a280] focus:ring-[#c0a280]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#2d2a26]">{reg.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{reg.authority}</span>
                      <span className="text-xs text-gray-300">•</span>
                      <span className="text-xs text-[#c0a280]">{reg.category}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Custom URLs */}
          <div>
            <h3 className="text-sm font-medium text-[#2d2a26] mb-3">Egna URL:er</h3>
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="Klistra in URL:er (en per rad)&#10;https://www.riksdagen.se/...&#10;https://www.fi.se/..."
              rows={4}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm
                         focus:outline-none focus:border-[#c0a280] focus:ring-2 focus:ring-[#c0a280]/10
                         resize-none"
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-2.5 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || (selectedPreset.length === 0 && !urls.trim())}
            className="px-6 py-2.5 bg-[#2d2a26] text-white rounded-xl text-sm font-medium
                       hover:bg-[#3d3a36] disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Hämtar...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Lägg till ({selectedPreset.length + (urls.split('\n').filter(Boolean).length)})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadModal({ 
  isOpen, 
  onClose, 
  onUpload,
  isLoading 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onUpload: (file: File, metadata: { title: string; documentNumber: string; authority: string }) => Promise<void>;
  isLoading: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [authority, setAuthority] = useState('');
  const [dragActive, setDragActive] = useState(false);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files?.[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf' || 
          droppedFile.type.includes('word') ||
          droppedFile.type === 'text/plain') {
        setFile(droppedFile);
        if (!title) {
          setTitle(droppedFile.name.replace(/\.[^/.]+$/, ''));
        }
      }
    }
  };

  const handleSubmit = async () => {
    if (file) {
      await onUpload(file, { title: title || file.name, documentNumber, authority });
      setFile(null);
      setTitle('');
      setDocumentNumber('');
      setAuthority('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#2d2a26]">Ladda upp dokument</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Drop zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragActive ? 'border-[#c0a280] bg-[#c0a280]/5' : 'border-gray-200'
            }`}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-[#c0a280]" />
                <div className="text-left">
                  <p className="font-medium text-[#2d2a26]">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button 
                  onClick={() => setFile(null)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-2">
                  Dra och släpp en fil här
                </p>
                <p className="text-xs text-gray-400 mb-4">eller</p>
                <label className="inline-block px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 cursor-pointer hover:bg-gray-200">
                  Välj fil
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setFile(e.target.files[0]);
                        if (!title) {
                          setTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                        }
                      }
                    }}
                  />
                </label>
                <p className="text-xs text-gray-400 mt-3">PDF, Word, eller textfiler</p>
              </>
            )}
          </div>

          {/* Metadata fields */}
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Titel"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm
                         focus:outline-none focus:border-[#c0a280]"
            />
            <input
              type="text"
              placeholder="Dokumentnummer (t.ex. FFFS 2013:10)"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm
                         focus:outline-none focus:border-[#c0a280]"
            />
            <input
              type="text"
              placeholder="Utfärdare (t.ex. Finansinspektionen)"
              value={authority}
              onChange={(e) => setAuthority(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm
                         focus:outline-none focus:border-[#c0a280]"
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-2.5 text-sm text-gray-600 hover:text-gray-800"
          >
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || isLoading}
            className="px-6 py-2.5 bg-[#2d2a26] text-white rounded-xl text-sm font-medium
                       hover:bg-[#3d3a36] disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Laddar upp...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Ladda upp
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function ComplianceArchivePage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingUrls, setIsAddingUrls] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/compliance/documents');
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      showNotification('error', 'Kunde inte hämta dokument');
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleAddUrls = async (urls: string[]) => {
    setIsAddingUrls(true);
    try {
      const response = await fetch('/api/compliance/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        showNotification('success', `${data.added} dokument lades till`);
        setShowUrlModal(false);
        fetchDocuments();
      } else {
        showNotification('error', data.error || 'Något gick fel');
      }
    } catch (error) {
      showNotification('error', 'Kunde inte lägga till dokument');
    } finally {
      setIsAddingUrls(false);
    }
  };

  const handleUpload = async (
    file: File, 
    metadata: { title: string; documentNumber: string; authority: string }
  ) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', metadata.title);
      formData.append('documentNumber', metadata.documentNumber);
      formData.append('authority', metadata.authority);

      const response = await fetch('/api/compliance/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        showNotification('success', 'Dokument uppladdat!');
        setShowUploadModal(false);
        fetchDocuments();
      } else {
        showNotification('error', data.error || 'Uppladdning misslyckades');
      }
    } catch (error) {
      showNotification('error', 'Kunde inte ladda upp dokument');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Är du säker på att du vill ta bort detta dokument?')) return;

    try {
      const response = await fetch(`/api/compliance/documents?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showNotification('success', 'Dokument borttaget');
        fetchDocuments();
      } else {
        showNotification('error', 'Kunde inte ta bort dokument');
      }
    } catch (error) {
      showNotification('error', 'Något gick fel');
    }
  };

  // Filter documents by search query
  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.metadata.documentNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.metadata.authority?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSourceIcon = (type: Document['sourceType']) => {
    switch (type) {
      case 'url': return <LinkIcon className="w-4 h-4" />;
      case 'pdf': return <FileText className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-[#2d2a26]">Regelverksarkiv</h1>
          <p className="text-sm text-gray-500 mt-1">
            Hantera dokument som används av AI-agenten
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowUrlModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl
                       text-sm font-medium text-[#2d2a26] hover:border-[#c0a280] transition-colors"
          >
            <LinkIcon className="w-4 h-4" />
            Lägg till URL
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2d2a26] text-white rounded-xl
                       text-sm font-medium hover:bg-[#3d3a36] transition-colors"
          >
            <Upload className="w-4 h-4" />
            Ladda upp
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 animate-fade-in ${
          notification.type === 'success' 
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {notification.message}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Sök i dokument..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl
                     text-sm focus:outline-none focus:border-[#c0a280] focus:ring-2 focus:ring-[#c0a280]/10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-2xl font-semibold text-[#2d2a26]">{documents.length}</p>
          <p className="text-sm text-gray-500">Dokument</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-2xl font-semibold text-[#2d2a26]">
            {documents.filter(d => d.sourceType === 'url').length}
          </p>
          <p className="text-sm text-gray-500">Webbsidor</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-2xl font-semibold text-[#2d2a26]">
            {documents.filter(d => d.sourceType === 'pdf').length}
          </p>
          <p className="text-sm text-gray-500">PDF:er</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-2xl font-semibold text-[#c0a280]">
            {new Set(documents.map(d => d.metadata.authority).filter(Boolean)).size}
          </p>
          <p className="text-sm text-gray-500">Källor</p>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-medium text-[#2d2a26]">Dokument</h2>
          <button
            onClick={fetchDocuments}
            className="text-gray-400 hover:text-[#c0a280] transition-colors"
            title="Uppdatera"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-[#c0a280] animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Laddar dokument...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Inga dokument ännu</p>
            <p className="text-sm text-gray-400 mb-6">
              Lägg till regelverk för att AI-agenten ska kunna svara på frågor
            </p>
            <button
              onClick={() => setShowUrlModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#c0a280]/10 text-[#c0a280] 
                         rounded-lg text-sm font-medium hover:bg-[#c0a280]/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Lägg till ditt första dokument
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  doc.sourceType === 'url' ? 'bg-blue-50 text-blue-600' : 'bg-[#c0a280]/10 text-[#c0a280]'
                }`}>
                  {getSourceIcon(doc.sourceType)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[#2d2a26] truncate">{doc.title}</h3>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    {doc.metadata.documentNumber && (
                      <span className="text-xs text-[#c0a280] bg-[#c0a280]/10 px-2 py-0.5 rounded-full">
                        {doc.metadata.documentNumber}
                      </span>
                    )}
                    {doc.metadata.authority && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Building2 className="w-3 h-3" />
                        {doc.metadata.authority}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" />
                      {new Date(doc.createdAt).toLocaleDateString('sv-SE')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {doc.sourceType === 'url' && (
                    <a
                      href={doc.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-400 hover:text-[#c0a280] transition-colors"
                      title="Öppna källa"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Ta bort"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddUrlModal
        isOpen={showUrlModal}
        onClose={() => setShowUrlModal(false)}
        onSubmit={handleAddUrls}
        isLoading={isAddingUrls}
      />
      
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUpload}
        isLoading={isUploading}
      />
    </div>
  );
}
