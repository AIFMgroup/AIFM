'use client';

import { useState, useEffect } from 'react';

import { useCompany } from '@/components/CompanyContext';

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface Document {
  id: string;
  title: string;
  source: string;
  sourceLabel: string;
  category: string;
  categoryLabel: string;
  documentNumber?: string;
  effectiveDate?: string;
  url: string;
  excerpt?: string;
  relevanceScore?: number;
}

interface CategoryFilter {
  id: string;
  label: string;
  count: number;
}

interface SourceFilter {
  id: string;
  label: string;
  count: number;
}

// Category and source mappings
const CATEGORIES: CategoryFilter[] = [
  { id: 'fffs', label: 'Finansinspektionens föreskrifter (FFFS)', count: 53 },
  { id: 'eu_regulation', label: 'EU-förordningar', count: 95 },
  { id: 'eu_directive', label: 'EU-direktiv', count: 44 },
  { id: 'swedish_law', label: 'Svenska lagar (SFS)', count: 35 },
  { id: 'swedish_regulation', label: 'Svenska förordningar', count: 33 },
  { id: 'esma_guideline', label: 'ESMA-riktlinjer', count: 118 },
  { id: 'esma_qa', label: 'ESMA Q&A', count: 10 },
  { id: 'corporate_governance', label: 'Bolagsstyrning', count: 3 },
  { id: 'other', label: 'Övrigt', count: 70 },
];

const SOURCES: SourceFilter[] = [
  { id: 'Finansinspektionen', label: 'Finansinspektionen', count: 79 },
  { id: 'EUR-Lex', label: 'EUR-Lex', count: 137 },
  { id: 'ESMA', label: 'ESMA', count: 41 },
  { id: 'EBA', label: 'EBA', count: 85 },
  { id: 'Sveriges Riksdag', label: 'Sveriges Riksdag', count: 65 },
  { id: 'SwedSec', label: 'SwedSec', count: 34 },
  { id: 'EIOPA', label: 'EIOPA', count: 2 },
  { id: 'FATF', label: 'FATF', count: 3 },
];

export default function ComplianceArchivePage() {
  const { selectedCompany } = useCompany();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalResults, setTotalResults] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search query
  const activeSearch = useDebounce(searchQuery, 300);

  // Load all documents on mount
  useEffect(() => {
    loadAllDocuments();
  }, []);

  const loadAllDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/data/regulations.json');
      if (response.ok) {
        const data: unknown = await response.json();
        const docs = Array.isArray(data)
          ? data.map((d) => {
              const rec = (d && typeof d === 'object' ? (d as Record<string, unknown>) : {}) as Record<string, unknown>;
              const id = typeof rec.id === 'string' ? rec.id : '';
              const title = typeof rec.title === 'string' ? rec.title : '';
              const source = typeof rec.source === 'string' ? rec.source : 'unknown';
              const category = typeof rec.category === 'string' ? rec.category : 'unknown';
              const url = typeof rec.url === 'string' ? rec.url : '';
              return {
                id,
                title,
                source,
                sourceLabel: source,
                category,
                categoryLabel: CATEGORIES.find((c) => c.id === category)?.label || category,
                url,
              };
            })
          : [];
        setAllDocuments(docs);
        setDocuments(docs);
        setTotalResults(docs.length);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter documents when search/filters change
  useEffect(() => {
    if (!allDocuments.length) return;
    
    let filtered = [...allDocuments];
    
    // Filter by search query
    if (activeSearch) {
      const query = activeSearch.toLowerCase();
      filtered = filtered.filter(d => 
        d.title.toLowerCase().includes(query) ||
        d.source.toLowerCase().includes(query) ||
        d.category.toLowerCase().includes(query)
      );
    }
    
    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(d => d.category === selectedCategory);
    }
    
    // Filter by source
    if (selectedSource) {
      filtered = filtered.filter(d => d.source === selectedSource);
    }
    
    setDocuments(filtered);
    setTotalResults(filtered.length);
  }, [activeSearch, selectedCategory, selectedSource, allDocuments]);

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedSource(null);
    setSearchQuery('');
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      fffs: 'bg-blue-100 text-blue-700',
      eu_regulation: 'bg-purple-100 text-purple-700',
      eu_directive: 'bg-indigo-100 text-indigo-700',
      swedish_law: 'bg-amber-100 text-amber-700',
      swedish_regulation: 'bg-orange-100 text-orange-700',
      esma_guideline: 'bg-green-100 text-green-700',
      esma_qa: 'bg-teal-100 text-teal-700',
      corporate_governance: 'bg-rose-100 text-rose-700',
      other: 'bg-gray-100 text-gray-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  return (
    
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Regelverksarkiv</h1>
          <p className="text-gray-500 mt-1">
            Sök och utforska {allDocuments.length || '...'} regelverk från EU, Finansinspektionen och andra myndigheter
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sök efter regelverk, t.ex. 'AIFMD', 'penningtvätt', 'SFDR'..."
                className="w-full px-4 py-3 pl-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-3 border rounded-xl transition-colors flex items-center gap-2 ${
                showFilters || selectedCategory || selectedSource
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filter
              {(selectedCategory || selectedSource) && (
                <span className="w-2 h-2 bg-purple-500 rounded-full" />
              )}
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Filtrera resultat</h3>
                {(selectedCategory || selectedSource) && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-purple-600 hover:text-purple-700"
                  >
                    Rensa filter
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Category filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                          selectedCategory === cat.id
                            ? 'bg-purple-100 text-purple-700'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <span>{cat.label}</span>
                        <span className="text-xs text-gray-500">{cat.count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Source filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Källa</label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {SOURCES.map((src) => (
                      <button
                        key={src.id}
                        onClick={() => setSelectedSource(selectedSource === src.id ? null : src.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                          selectedSource === src.id
                            ? 'bg-purple-100 text-purple-700'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <span>{src.label}</span>
                        <span className="text-xs text-gray-500">{src.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {isLoading ? (
              'Söker...'
            ) : activeSearch || selectedCategory || selectedSource ? (
              `${totalResults} resultat`
            ) : (
              `Visar utvalda regelverk av totalt ${totalResults}`
            )}
          </p>
          {(activeSearch || selectedCategory || selectedSource) && (
            <button
              onClick={clearFilters}
              className="text-sm text-purple-600 hover:text-purple-700"
            >
              Visa alla
            </button>
          )}
        </div>

        {/* Results */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-purple-600 rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 mt-4">Söker i regelverksarkivet...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500">Inga dokument hittades</p>
              <p className="text-sm text-gray-400 mt-1">Försök med andra sökord eller filter</p>
            </div>
          ) : (
            documents.map((doc) => (
              <a
                key={doc.id}
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white rounded-2xl border border-gray-200 p-6 hover:border-purple-300 hover:shadow-lg transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryColor(doc.category)}`}>
                        {doc.categoryLabel}
                      </span>
                      {doc.documentNumber && (
                        <span className="text-xs text-gray-500 font-mono">
                          {doc.documentNumber}
                        </span>
                      )}
                      {doc.relevanceScore && doc.relevanceScore > 0 && (
                        <span className="text-xs text-gray-400">
                          {Math.round(doc.relevanceScore * 100)}% matchning
                        </span>
                      )}
                    </div>
                    
                    <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-2">
                      {doc.title}
                    </h3>
                    
                    {doc.excerpt && (
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                        {doc.excerpt}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      <span>{doc.sourceLabel}</span>
                      {doc.effectiveDate && (
                        <>
                          <span>•</span>
                          <span>Gäller från: {new Date(doc.effectiveDate).toLocaleDateString('sv-SE')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <svg 
                    className="w-5 h-5 text-gray-400 group-hover:text-purple-500 transition-colors flex-shrink-0 mt-1" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
              </a>
            ))
          )}
        </div>

        {/* Quick links */}
        {!activeSearch && !selectedCategory && !selectedSource && (
          <div className="mt-8 bg-purple-50 rounded-2xl p-6">
            <h3 className="font-semibold text-purple-900 mb-4">Populära regelverk</h3>
            <div className="flex flex-wrap gap-2">
              {['AIFMD', 'SFDR', 'MiFID II', 'MAR', 'EMIR', 'Penningtvätt', 'Bolagsstyrning', 'Kapitaltäckning'].map((term) => (
                <button
                  key={term}
                  onClick={() => setSearchQuery(term)}
                  className="px-3 py-1.5 bg-white text-purple-700 rounded-full text-sm hover:bg-purple-100 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
  );
}
