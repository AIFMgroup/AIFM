'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Upload,
  FileText,
  Trash2,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Database,
  BookOpen,
  FileUp,
  Brain,
  Loader2,
  X,
  Download,
  Filter,
  Plus,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface KnowledgeDocument {
  id: string;
  title: string;
  documentNumber?: string;
  category: string;
  categoryLabel: string;
  source: string;
  sourceLabel: string;
  status: 'pending' | 'processing' | 'embedded' | 'failed';
  createdAt: string;
  updatedAt: string;
  chunkCount?: number;
  fileSize?: string;
}

interface KnowledgeBaseStats {
  totalDocuments: number;
  embeddedDocuments: number;
  pendingDocuments: number;
  lastSync: string | null;
  status: string;
}

interface UploadFormData {
  title: string;
  content: string;
  category: string;
  documentNumber: string;
  effectiveDate: string;
  source: string;
}

// ============================================================================
// Categories & Sources
// ============================================================================

const CATEGORIES = [
  { value: 'swedish_law', label: 'Svensk lag (SFS)' },
  { value: 'fffs', label: 'FI-föreskrifter (FFFS)' },
  { value: 'eu_regulation', label: 'EU-förordning' },
  { value: 'eu_directive', label: 'EU-direktiv' },
  { value: 'fi_guidance', label: 'FI vägledning' },
  { value: 'esma', label: 'ESMA riktlinjer' },
  { value: 'internal_policy', label: 'Intern policy' },
  { value: 'fund_rules', label: 'Fondbestämmelser' },
  { value: 'contract', label: 'Avtal/Kontrakt' },
  { value: 'other', label: 'Övrigt' },
];

const SOURCES = [
  { value: 'riksdagen', label: 'Riksdagen' },
  { value: 'fi', label: 'Finansinspektionen' },
  { value: 'eu', label: 'EU/EUR-Lex' },
  { value: 'esma', label: 'ESMA' },
  { value: 'eba', label: 'EBA' },
  { value: 'internal', label: 'Internt dokument' },
  { value: 'external', label: 'Extern källa' },
];

// ============================================================================
// Main Component
// ============================================================================

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [stats, setStats] = useState<KnowledgeBaseStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load stats
      const statsRes = await fetch('/api/compliance/knowledge-base?action=stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats({
          totalDocuments: statsData.knowledgeBase?.totalDocuments || 0,
          embeddedDocuments: statsData.userDocuments?.embedded || 0,
          pendingDocuments: statsData.userDocuments?.total - statsData.userDocuments?.embedded || 0,
          lastSync: statsData.knowledgeBase?.lastSync || null,
          status: statsData.knowledgeBase?.status || 'unknown',
        });
      }

      // Load documents
      const docsRes = await fetch('/api/compliance/knowledge-base?action=list-documents');
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(docsData.documents || []);
      }
    } catch (error) {
      console.error('Failed to load knowledge base data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync knowledge base
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/compliance/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Synkronisering startad! Job ID: ${data.ingestionJobId}`);
        loadData();
      } else {
        const error = await response.json();
        alert(`❌ Synkronisering misslyckades: ${error.error}`);
      }
    } catch (error) {
      alert('❌ Kunde inte starta synkronisering');
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete document
  const handleDelete = async (documentId: string, title: string) => {
    if (!confirm(`Är du säker på att du vill ta bort "${title}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/compliance/knowledge-base?documentId=${documentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDocuments(docs => docs.filter(d => d.id !== documentId));
        alert('✅ Dokumentet har tagits bort');
      } else {
        alert('❌ Kunde inte ta bort dokumentet');
      }
    } catch (error) {
      alert('❌ Ett fel uppstod');
    }
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchQuery || 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.documentNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-aifm-gold" />
          <p className="text-aifm-charcoal/60">Laddar kunskapsbas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/settings"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-aifm-charcoal/60" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-aifm-charcoal">Kunskapsbas</h1>
            <p className="text-aifm-charcoal/60 mt-1">
              Hantera dokument för AI-assistenten
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            Synkronisera
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-aifm-gold text-white rounded-xl hover:bg-aifm-gold/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ladda upp dokument
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Database}
          label="Totalt antal dokument"
          value={stats?.totalDocuments || 0}
          color="blue"
        />
        <StatCard
          icon={CheckCircle2}
          label="Indexerade"
          value={stats?.embeddedDocuments || 0}
          color="green"
        />
        <StatCard
          icon={Clock}
          label="Väntar på indexering"
          value={stats?.pendingDocuments || 0}
          color="amber"
        />
        <StatCard
          icon={Brain}
          label="Status"
          value={stats?.status === 'ACTIVE' ? 'Aktiv' : stats?.status || 'Okänd'}
          color="purple"
          isText
        />
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800">Hur kunskapsbasen fungerar</h4>
            <p className="text-sm text-blue-700 mt-1">
              Dokument som laddas upp delas upp i mindre delar (chunks), indexeras med AI-embeddings, 
              och blir sökbara för chatboten. När användare ställer frågor söker AI:n först i dessa 
              dokument innan den använder sin generella kunskap.
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Sök dokument..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-aifm-gold"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="pl-10 pr-8 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-aifm-gold appearance-none bg-white"
          >
            <option value="all">Alla kategorier</option>
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-aifm-charcoal/70">Dokument</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-aifm-charcoal/70">Kategori</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-aifm-charcoal/70">Status</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-aifm-charcoal/70">Uppladdat</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-aifm-charcoal/70">Åtgärder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-aifm-charcoal/50">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Inga dokument hittades</p>
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="mt-3 text-aifm-gold hover:underline"
                    >
                      Ladda upp ditt första dokument
                    </button>
                  </td>
                </tr>
              ) : (
                filteredDocuments.map(doc => (
                  <tr key={doc.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-aifm-charcoal">{doc.title}</p>
                          {doc.documentNumber && (
                            <p className="text-sm text-aifm-charcoal/50">{doc.documentNumber}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-700">
                        {doc.categoryLabel || doc.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-aifm-charcoal/60">
                      {new Date(doc.createdAt).toLocaleDateString('sv-SE')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDelete(doc.id, doc.title)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Ta bort"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadModal
          onClose={() => {
            setShowUploadModal(false);
            setUploadError(null);
          }}
          onSuccess={() => {
            setShowUploadModal(false);
            setUploadError(null);
            loadData();
          }}
          error={uploadError}
          setError={setUploadError}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sub Components
// ============================================================================

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color, 
  isText = false 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number | string; 
  color: 'blue' | 'green' | 'amber' | 'purple';
  isText?: boolean;
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  };

  return (
    <div className={`p-4 rounded-xl border ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium opacity-80">{label}</span>
      </div>
      <p className={`${isText ? 'text-lg' : 'text-2xl'} font-bold`}>
        {typeof value === 'number' ? value.toLocaleString('sv-SE') : value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    embedded: { label: 'Indexerad', color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
    processing: { label: 'Bearbetas', color: 'bg-blue-50 text-blue-700', icon: RefreshCw },
    pending: { label: 'Väntar', color: 'bg-amber-50 text-amber-700', icon: Clock },
    failed: { label: 'Misslyckades', color: 'bg-red-50 text-red-700', icon: AlertCircle },
  };

  const config = configs[status] || configs.pending;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className={`w-3.5 h-3.5 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
}

function UploadModal({
  onClose,
  onSuccess,
  error,
  setError,
}: {
  onClose: () => void;
  onSuccess: () => void;
  error: string | null;
  setError: (error: string | null) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'text' | 'file'>('text');
  const [formData, setFormData] = useState<UploadFormData>({
    title: '',
    content: '',
    category: 'other',
    documentNumber: '',
    effectiveDate: '',
    source: 'internal',
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const allowedTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
      setError('Endast .txt, .md, .pdf och .docx-filer stöds för närvarande');
      return;
    }

    // Read text files directly
    if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setFormData(prev => ({
          ...prev,
          content,
          title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
        }));
      };
      reader.readAsText(file);
    } else {
      // For PDF/DOCX, we'd need server-side processing
      setError('PDF och DOCX-filer kräver server-side bearbetning. Använd textinmatning för nu.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('Titel är obligatoriskt');
      return;
    }

    if (!formData.content.trim()) {
      setError('Innehåll är obligatoriskt');
      return;
    }

    setIsUploading(true);

    try {
      const response = await fetch('/api/compliance/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload',
          title: formData.title,
          content: formData.content,
          category: formData.category,
          documentNumber: formData.documentNumber || undefined,
          effectiveDate: formData.effectiveDate || undefined,
          source: formData.source,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ ${data.message}`);
        onSuccess();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Uppladdning misslyckades');
      }
    } catch (err) {
      setError('Ett fel uppstod vid uppladdning');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-aifm-gold/10 rounded-xl flex items-center justify-center">
              <FileUp className="w-5 h-5 text-aifm-gold" />
            </div>
            <div>
              <h2 className="font-semibold text-aifm-charcoal">Ladda upp dokument</h2>
              <p className="text-sm text-aifm-charcoal/60">Lägg till i kunskapsbasen</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Upload Type Toggle */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => setUploadType('text')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                uploadType === 'text' 
                  ? 'bg-white text-aifm-charcoal shadow-sm' 
                  : 'text-aifm-charcoal/60 hover:text-aifm-charcoal'
              }`}
            >
              Klistra in text
            </button>
            <button
              type="button"
              onClick={() => setUploadType('file')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                uploadType === 'file' 
                  ? 'bg-white text-aifm-charcoal shadow-sm' 
                  : 'text-aifm-charcoal/60 hover:text-aifm-charcoal'
              }`}
            >
              Ladda upp fil
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">
              Titel <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="t.ex. FFFS 2013:10 - AIF-förvaltare"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-aifm-gold"
            />
          </div>

          {/* Document Number & Effective Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">
                Dokumentnummer
              </label>
              <input
                type="text"
                value={formData.documentNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, documentNumber: e.target.value }))}
                placeholder="t.ex. FFFS 2013:10"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-aifm-gold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">
                Gäller från
              </label>
              <input
                type="date"
                value={formData.effectiveDate}
                onChange={(e) => setFormData(prev => ({ ...prev, effectiveDate: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-aifm-gold"
              />
            </div>
          </div>

          {/* Category & Source */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">
                Kategori
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-aifm-gold"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">
                Källa
              </label>
              <select
                value={formData.source}
                onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-aifm-gold"
              >
                {SOURCES.map(src => (
                  <option key={src.value} value={src.value}>{src.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Content Input */}
          {uploadType === 'text' ? (
            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">
                Innehåll <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Klistra in dokumentets text här..."
                rows={12}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-aifm-gold resize-none font-mono text-sm"
              />
              <p className="mt-1.5 text-xs text-aifm-charcoal/50">
                {formData.content.length.toLocaleString()} tecken
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-1.5">
                Fil
              </label>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-aifm-gold/50 transition-colors">
                <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                <p className="text-aifm-charcoal/60 mb-2">
                  Dra och släpp eller klicka för att välja
                </p>
                <p className="text-xs text-aifm-charcoal/40">
                  Stöder .txt, .md filer (PDF/DOCX kommer snart)
                </p>
                <input
                  type="file"
                  accept=".txt,.md,.pdf,.docx"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              {formData.content && (
                <p className="mt-2 text-sm text-emerald-600 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Fil laddad: {formData.content.length.toLocaleString()} tecken
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            disabled={isUploading}
            className="flex items-center gap-2 px-5 py-2.5 bg-aifm-gold text-white rounded-xl hover:bg-aifm-gold/90 transition-colors disabled:opacity-50"
          >
            {isUploading ? (
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
