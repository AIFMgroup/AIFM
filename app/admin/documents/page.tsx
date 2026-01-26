'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Search,
  Filter,
  ChevronDown,
  MoreVertical,
  Download,
  Trash2,
  Eye,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Database,
  BookOpen,
  Scale,
  Building2,
  Calendar,
  Tag,
  Plus,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type DocumentStatus = 'indexed' | 'pending' | 'error' | 'processing';
type DocumentSource = 'fi' | 'esma' | 'manual' | 'scraped';
type DocumentCategory = 'regulation' | 'guideline' | 'policy' | 'template' | 'other';

interface ComplianceDocument {
  id: string;
  title: string;
  source: DocumentSource;
  category: DocumentCategory;
  status: DocumentStatus;
  uploadedAt: string;
  indexedAt?: string;
  fileSize: number;
  fileType: string;
  lastScraped?: string;
  url?: string;
  tags: string[];
  chunkCount?: number;
}

interface ScraperStats {
  lastRun: string;
  documentsFound: number;
  documentsNew: number;
  documentsUpdated: number;
  errors: number;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockDocuments: ComplianceDocument[] = [
  {
    id: '1',
    title: 'AIFMD - Directive 2011/61/EU',
    source: 'esma',
    category: 'regulation',
    status: 'indexed',
    uploadedAt: '2024-01-05T10:00:00Z',
    indexedAt: '2024-01-05T10:15:00Z',
    fileSize: 2456000,
    fileType: 'pdf',
    url: 'https://eur-lex.europa.eu/...',
    tags: ['AIFMD', 'EU', 'Directive'],
    chunkCount: 156,
  },
  {
    id: '2',
    title: 'FI:s föreskrifter om AIF-förvaltare (FFFS 2013:10)',
    source: 'fi',
    category: 'regulation',
    status: 'indexed',
    uploadedAt: '2024-01-06T09:30:00Z',
    indexedAt: '2024-01-06T09:45:00Z',
    fileSize: 890000,
    fileType: 'pdf',
    lastScraped: '2024-01-08T06:00:00Z',
    url: 'https://www.fi.se/...',
    tags: ['FI', 'FFFS', 'AIF'],
    chunkCount: 89,
  },
  {
    id: '3',
    title: 'ESMA Guidelines on sound remuneration policies',
    source: 'esma',
    category: 'guideline',
    status: 'indexed',
    uploadedAt: '2024-01-07T14:00:00Z',
    indexedAt: '2024-01-07T14:20:00Z',
    fileSize: 1234000,
    fileType: 'pdf',
    tags: ['ESMA', 'Remuneration', 'Guidelines'],
    chunkCount: 67,
  },
  {
    id: '4',
    title: 'Intern riskhanteringspolicy',
    source: 'manual',
    category: 'policy',
    status: 'indexed',
    uploadedAt: '2024-01-08T08:00:00Z',
    indexedAt: '2024-01-08T08:10:00Z',
    fileSize: 456000,
    fileType: 'pdf',
    tags: ['Intern', 'Risk', 'Policy'],
    chunkCount: 34,
  },
  {
    id: '5',
    title: 'FI:s vägledning om kapitalbuffertar',
    source: 'fi',
    category: 'guideline',
    status: 'processing',
    uploadedAt: '2024-01-08T14:30:00Z',
    fileSize: 678000,
    fileType: 'pdf',
    lastScraped: '2024-01-08T14:30:00Z',
    tags: ['FI', 'Kapital', 'Buffer'],
  },
  {
    id: '6',
    title: 'AIFMD Level 2 Regulation (EU) No 231/2013',
    source: 'esma',
    category: 'regulation',
    status: 'error',
    uploadedAt: '2024-01-04T11:00:00Z',
    fileSize: 3456000,
    fileType: 'pdf',
    tags: ['AIFMD', 'Level 2', 'EU'],
  },
];

const mockScraperStats: Record<DocumentSource, ScraperStats> = {
  fi: {
    lastRun: '2024-01-08T06:00:00Z',
    documentsFound: 234,
    documentsNew: 3,
    documentsUpdated: 12,
    errors: 0,
  },
  esma: {
    lastRun: '2024-01-08T06:00:00Z',
    documentsFound: 567,
    documentsNew: 5,
    documentsUpdated: 8,
    errors: 1,
  },
  manual: {
    lastRun: '2024-01-08T08:00:00Z',
    documentsFound: 45,
    documentsNew: 1,
    documentsUpdated: 0,
    errors: 0,
  },
  scraped: {
    lastRun: '2024-01-08T06:00:00Z',
    documentsFound: 0,
    documentsNew: 0,
    documentsUpdated: 0,
    errors: 0,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusConfig(status: DocumentStatus) {
  const configs = {
    indexed: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2, label: 'Indexerad' },
    pending: { color: 'bg-gray-50 text-gray-600 border-gray-200', icon: Clock, label: 'Väntar' },
    processing: { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: RefreshCw, label: 'Bearbetas' },
    error: { color: 'bg-red-50 text-red-700 border-red-200', icon: AlertCircle, label: 'Fel' },
  };
  return configs[status];
}

function getSourceConfig(source: DocumentSource) {
  const configs = {
    fi: { label: 'Finansinspektionen', color: 'bg-blue-100 text-blue-800' },
    esma: { label: 'ESMA', color: 'bg-purple-100 text-purple-800' },
    manual: { label: 'Manuell', color: 'bg-gray-100 text-gray-800' },
    scraped: { label: 'Scrapad', color: 'bg-amber-100 text-amber-800' },
  };
  return configs[source];
}

function getCategoryConfig(category: DocumentCategory) {
  const configs = {
    regulation: { label: 'Förordning', icon: Scale },
    guideline: { label: 'Vägledning', icon: BookOpen },
    policy: { label: 'Policy', icon: Building2 },
    template: { label: 'Mall', icon: FileText },
    other: { label: 'Övrigt', icon: FileText },
  };
  return configs[category];
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString?: string) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================================
// Main Component
// ============================================================================

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<ComplianceDocument[]>(mockDocuments);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<DocumentSource | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isRunningScrapers, setIsRunningScrapers] = useState(false);

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      searchQuery === '' ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || doc.source === sourceFilter;

    return matchesSearch && matchesStatus && matchesSource;
  });

  const handleRunScrapers = async () => {
    setIsRunningScrapers(true);
    try {
      const res = await fetch('/api/compliance/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: ['all'] }),
      });
      const data = await res.json();
      console.log('Scraper result:', data);
      // Refresh documents list
    } catch (error) {
      console.error('Scraper error:', error);
    } finally {
      setIsRunningScrapers(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Är du säker på att du vill ta bort detta dokument?')) return;
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const handleReindex = async (docId: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, status: 'processing' as DocumentStatus } : d))
    );
    // TODO: Call reindex API
  };

  // Stats
  const stats = {
    total: documents.length,
    indexed: documents.filter((d) => d.status === 'indexed').length,
    pending: documents.filter((d) => d.status === 'pending' || d.status === 'processing').length,
    errors: documents.filter((d) => d.status === 'error').length,
    totalChunks: documents.reduce((sum, d) => sum + (d.chunkCount || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-aifm-charcoal">Compliance-dokument</h1>
          <p className="text-sm text-aifm-charcoal/50 mt-1">
            Hantera dokument i Knowledge Base för compliance-agenten.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunScrapers}
            disabled={isRunningScrapers}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-aifm-charcoal rounded-xl text-sm font-medium
                       hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRunningScrapers ? 'animate-spin' : ''}`} />
            Kör scrapers
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-aifm-charcoal text-white rounded-xl text-sm font-medium
                       hover:bg-aifm-charcoal/90 transition-all"
          >
            <Upload className="w-4 h-4" />
            Ladda upp
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-aifm-charcoal/50" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
              Totalt
            </span>
          </div>
          <p className="text-2xl font-semibold text-aifm-charcoal">{stats.total}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
              Indexerade
            </span>
          </div>
          <p className="text-2xl font-semibold text-emerald-600">{stats.indexed}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
              Väntar
            </span>
          </div>
          <p className="text-2xl font-semibold text-blue-600">{stats.pending}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
              Fel
            </span>
          </div>
          <p className="text-2xl font-semibold text-red-600">{stats.errors}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-aifm-gold" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
              Chunks
            </span>
          </div>
          <p className="text-2xl font-semibold text-aifm-charcoal">{stats.totalChunks}</p>
        </div>
      </div>

      {/* Scraper Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(['fi', 'esma', 'manual'] as const).map((source) => {
          const stats = mockScraperStats[source];
          const config = getSourceConfig(source);
          return (
            <div key={source} className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                  {config.label}
                </span>
                <span className="text-xs text-aifm-charcoal/40">
                  {formatDate(stats.lastRun)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-semibold text-aifm-charcoal">{stats.documentsNew}</p>
                  <p className="text-[10px] text-aifm-charcoal/40">Nya</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-aifm-charcoal">{stats.documentsUpdated}</p>
                  <p className="text-[10px] text-aifm-charcoal/40">Uppdaterade</p>
                </div>
                <div>
                  <p className={`text-lg font-semibold ${stats.errors > 0 ? 'text-red-600' : 'text-aifm-charcoal'}`}>
                    {stats.errors}
                  </p>
                  <p className="text-[10px] text-aifm-charcoal/40">Fel</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aifm-charcoal/30" />
            <input
              type="text"
              placeholder="Sök dokument eller taggar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm
                         focus:outline-none focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/10"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-all ${
              showFilters || statusFilter !== 'all' || sourceFilter !== 'all'
                ? 'border-aifm-gold bg-aifm-gold/5 text-aifm-gold'
                : 'border-gray-200 text-aifm-charcoal/70 hover:border-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filter
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-aifm-charcoal/50">Status:</span>
              {(['all', 'indexed', 'pending', 'processing', 'error'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    statusFilter === status
                      ? 'bg-aifm-charcoal text-white'
                      : 'bg-gray-100 text-aifm-charcoal/70 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' ? 'Alla' : getStatusConfig(status as DocumentStatus).label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-aifm-charcoal/50">Källa:</span>
              {(['all', 'fi', 'esma', 'manual'] as const).map((source) => (
                <button
                  key={source}
                  onClick={() => setSourceFilter(source)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    sourceFilter === source
                      ? 'bg-aifm-charcoal text-white'
                      : 'bg-gray-100 text-aifm-charcoal/70 hover:bg-gray-200'
                  }`}
                >
                  {source === 'all' ? 'Alla' : getSourceConfig(source as DocumentSource).label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Documents Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-4 text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
                  Dokument
                </th>
                <th className="text-left px-5 py-4 text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
                  Källa
                </th>
                <th className="text-left px-5 py-4 text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
                  Status
                </th>
                <th className="text-left px-5 py-4 text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
                  Storlek
                </th>
                <th className="text-left px-5 py-4 text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
                  Indexerad
                </th>
                <th className="text-right px-5 py-4 text-[10px] uppercase tracking-wider font-semibold text-aifm-charcoal/40">
                  Åtgärder
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-aifm-charcoal/50">
                    Inga dokument matchar din sökning.
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc) => {
                  const statusConfig = getStatusConfig(doc.status);
                  const sourceConfig = getSourceConfig(doc.source);
                  const categoryConfig = getCategoryConfig(doc.category);
                  const CategoryIcon = categoryConfig.icon;
                  const StatusIcon = statusConfig.icon;

                  return (
                    <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <CategoryIcon className="w-5 h-5 text-aifm-charcoal/50" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-aifm-charcoal line-clamp-1">{doc.title}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {doc.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                              {doc.tags.length > 3 && (
                                <span className="text-[10px] text-aifm-charcoal/40">
                                  +{doc.tags.length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sourceConfig.color}`}>
                          {sourceConfig.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}
                        >
                          <StatusIcon className={`w-3.5 h-3.5 ${doc.status === 'processing' ? 'animate-spin' : ''}`} />
                          {statusConfig.label}
                        </span>
                        {doc.chunkCount && doc.status === 'indexed' && (
                          <p className="text-[10px] text-aifm-charcoal/40 mt-1">{doc.chunkCount} chunks</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-aifm-charcoal">{formatFileSize(doc.fileSize)}</span>
                        <p className="text-[10px] text-aifm-charcoal/40 uppercase">{doc.fileType}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-aifm-charcoal">{formatDate(doc.indexedAt)}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {doc.url && (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-aifm-charcoal/50 hover:text-aifm-charcoal hover:bg-gray-100 rounded-lg transition-colors"
                              title="Öppna original"
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => handleReindex(doc.id)}
                            className="p-2 text-aifm-charcoal/50 hover:text-aifm-gold hover:bg-aifm-gold/10 rounded-lg transition-colors"
                            title="Omindexera"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-2 text-aifm-charcoal/50 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Ta bort"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
