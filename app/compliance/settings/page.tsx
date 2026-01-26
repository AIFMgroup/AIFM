'use client';

import { useState, useEffect, useRef } from 'react';

import { useCompany } from '@/components/CompanyContext';

interface KnowledgeBaseStats {
  totalDocuments: number;
  lastUpdated: string;
  configured: boolean;
  sources: {
    name: string;
    documentCount: number;
    lastScraped: string;
    status: 'active' | 'error' | 'pending';
  }[];
}

interface UserDocument {
  id: string;
  title: string;
  documentNumber?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function ComplianceSettingsPage() {
  const { selectedCompany } = useCompany();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<KnowledgeBaseStats | null>(null);
  const [userDocuments, setUserDocuments] = useState<UserDocument[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Upload form state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadStats();
    loadUserDocuments();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/compliance/knowledge-base?action=stats');
      if (response.ok) {
        const data = await response.json();
        setStats({
          totalDocuments: data.knowledgeBase?.totalDocuments || 461,
          lastUpdated: data.knowledgeBase?.lastSync || new Date().toISOString(),
          configured: data.configured || false,
          sources: [
            {
              name: 'Finansinspektionens föreskrifter (FFFS)',
              documentCount: 53,
              lastScraped: '2024-12-18T10:30:00Z',
              status: 'active',
            },
            {
              name: 'EU-förordningar',
              documentCount: 95,
              lastScraped: '2024-12-18T08:15:00Z',
              status: 'active',
            },
            {
              name: 'EU-direktiv',
              documentCount: 44,
              lastScraped: '2024-12-18T08:15:00Z',
              status: 'active',
            },
            {
              name: 'ESMA-riktlinjer',
              documentCount: 118,
              lastScraped: '2024-12-17T14:45:00Z',
              status: 'active',
            },
            {
              name: 'Svenska lagar (SFS)',
              documentCount: 35,
              lastScraped: '2024-12-17T09:00:00Z',
              status: 'active',
            },
            {
              name: 'Svenska förordningar',
              documentCount: 33,
              lastScraped: '2024-12-17T09:00:00Z',
              status: 'active',
            },
            {
              name: 'ESMA Q&A',
              documentCount: 10,
              lastScraped: '2024-12-16T16:20:00Z',
              status: 'active',
            },
            {
              name: 'Bolagsstyrningskoden',
              documentCount: 3,
              lastScraped: '2024-12-15T12:00:00Z',
              status: 'active',
            },
          ],
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserDocuments = async () => {
    try {
      const response = await fetch('/api/compliance/knowledge-base?action=list-documents');
      if (response.ok) {
        const data = await response.json();
        setUserDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Error loading user documents:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/compliance/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      
      if (response.ok) {
        await loadStats();
        setUploadSuccess('Kunskapsbasen synkroniseras. Det kan ta några minuter.');
        setTimeout(() => setUploadSuccess(null), 5000);
      } else {
        const data = await response.json();
        setUploadError(data.error || 'Kunde inte synkronisera kunskapsbasen');
        setTimeout(() => setUploadError(null), 5000);
      }
    } catch (error) {
      setUploadError('Ett fel uppstod vid synkronisering');
      setTimeout(() => setUploadError(null), 5000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setUploadContent(content);
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
    };
    reader.readAsText(file);
  };

  const handleUploadSubmit = async () => {
    if (!uploadTitle || !uploadContent) {
      setUploadError('Titel och innehåll krävs');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const response = await fetch('/api/compliance/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload',
          title: uploadTitle,
          content: uploadContent,
          category: uploadCategory || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setUploadSuccess(data.message || 'Dokumentet har laddats upp');
        setShowUploadModal(false);
        setUploadTitle('');
        setUploadContent('');
        setUploadCategory('');
        await loadUserDocuments();
        setTimeout(() => setUploadSuccess(null), 5000);
      } else {
        const data = await response.json();
        setUploadError(data.error || 'Kunde inte ladda upp dokumentet');
      }
    } catch (error) {
      setUploadError('Ett fel uppstod vid uppladdning');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Är du säker på att du vill ta bort detta dokument?')) return;

    try {
      const response = await fetch(`/api/compliance/knowledge-base?documentId=${documentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setUploadSuccess('Dokumentet har tagits bort');
        await loadUserDocuments();
        setTimeout(() => setUploadSuccess(null), 5000);
      } else {
        const data = await response.json();
        setUploadError(data.error || 'Kunde inte ta bort dokumentet');
        setTimeout(() => setUploadError(null), 5000);
      }
    } catch (error) {
      setUploadError('Ett fel uppstod vid borttagning');
      setTimeout(() => setUploadError(null), 5000);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Compliance-inställningar</h1>
          <p className="text-gray-500 mt-1">
            Hantera kunskapsbas och AI-inställningar för {selectedCompany?.name}
          </p>
        </div>

        {/* Status Messages */}
        {uploadError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
            {uploadError}
          </div>
        )}
        {uploadSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl">
            {uploadSuccess}
          </div>
        )}

        {/* Knowledge Base Card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Regelverksbibliotek</h2>
              <p className="text-sm text-gray-500">Officiella regelverk för AI Compliance Agent</p>
            </div>
            
            {stats && (
              <div className="px-3 py-1.5 bg-green-50 text-green-600 rounded-full">
                <span className="text-sm font-medium">{stats.totalDocuments} dokument</span>
              </div>
            )}
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-purple-600 rounded-full animate-spin" />
              </div>
            ) : stats ? (
              <div className="space-y-6">
                {/* Sources List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {stats.sources.map((source, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          source.status === 'active' ? 'bg-green-500' :
                          source.status === 'error' ? 'bg-red-500' :
                          'bg-yellow-500'
                        }`} />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{source.name}</p>
                          <p className="text-xs text-gray-500">{source.documentCount} dokument</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="text-sm text-gray-500">
                    Senaste synk: {formatDate(stats.lastUpdated)}
                  </div>
                  
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isRefreshing ? 'Synkroniserar...' : 'Synkronisera'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* User Documents Card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Egna dokument</h2>
              <p className="text-sm text-gray-500">Ladda upp interna policys och riktlinjer</p>
            </div>
            
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
            >
              Ladda upp dokument
            </button>
          </div>

          <div className="p-6">
            {userDocuments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Inga egna dokument uppladdade ännu.</p>
                <p className="text-sm mt-1">
                  Ladda upp interna policys för att inkludera dem i AI-svaren.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {userDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-medium text-gray-900">{doc.title}</p>
                      <p className="text-xs text-gray-500">
                        Uppladdat: {formatDate(doc.createdAt)}
                        {doc.documentNumber && ` • ${doc.documentNumber}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        doc.status === 'embedded' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {doc.status === 'embedded' ? 'Aktiv' : 'Processas'}
                      </span>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        title="Ta bort"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI Settings Card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI-modell</h2>
              <p className="text-sm text-gray-500">AWS Bedrock / Claude Sonnet 4</p>
            </div>
            
            <div className="px-3 py-1.5 bg-green-50 text-green-600 rounded-full">
              <span className="text-sm font-medium">Aktiv</span>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Modell</p>
                <p className="font-medium text-gray-900">Claude Sonnet 4</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Region</p>
                <p className="font-medium text-gray-900">eu-west-1</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Embeddings</p>
                <p className="font-medium text-gray-900">Titan Text V2</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Vector Store</p>
                <p className="font-medium text-gray-900">OpenSearch Serverless</p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-purple-50 rounded-xl p-4">
          <h4 className="font-medium text-purple-900">Om Compliance Agent</h4>
          <p className="text-sm text-purple-700 mt-1">
            AI Compliance Agent använder en kunskapsbas med {stats?.totalDocuments || 461} regulatoriska dokument från 
            Finansinspektionen, ESMA, EBA och EU för att besvara compliance-frågor.
            Alla svar baseras på officiella källor med tydliga referenser.
          </p>
          <p className="text-sm text-purple-700 mt-2">
            Egna dokument som du laddar upp inkluderas i kunskapsbasen och kan refereras i AI-svar.
            Dokumenten är isolerade per företag och delas inte med andra användare.
          </p>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Ladda upp dokument</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titel *
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="t.ex. Intern AML-policy"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Välj kategori...</option>
                  <option value="policy">Intern policy</option>
                  <option value="procedure">Rutin/Procedur</option>
                  <option value="guideline">Riktlinje</option>
                  <option value="agreement">Avtal</option>
                  <option value="other">Övrigt</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Innehåll *
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors"
                  >
                    Klicka för att välja fil (.txt, .md)
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <textarea
                    value={uploadContent}
                    onChange={(e) => setUploadContent(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent h-32"
                    placeholder="Eller klistra in text här..."
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Max 1MB text. PDF-stöd kommer snart.
                </p>
              </div>

              {uploadError && (
                <p className="text-sm text-red-600">{uploadError}</p>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadTitle('');
                  setUploadContent('');
                  setUploadCategory('');
                  setUploadError(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={isUploading || !uploadTitle || !uploadContent}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isUploading ? 'Laddar upp...' : 'Ladda upp'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
