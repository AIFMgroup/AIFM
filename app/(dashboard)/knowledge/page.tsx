'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as LucideIcons from 'lucide-react';

// Destructure icons with fallbacks to prevent undefined
const { 
  BookOpen = () => null, 
  Search = () => null, 
  Filter = () => null, 
  Users = () => null, 
  Handshake = () => null, 
  Shield = () => null, 
  Building2 = () => null,
  Calendar = () => null,
  User = () => null,
  Tag = () => null,
  Trash2 = () => null,
  Edit3 = () => null,
  ChevronDown = () => null,
  X = () => null,
  Loader2 = () => null,
  RefreshCw = () => null,
  MessageSquare = () => null,
  ArrowLeft = () => null,
} = LucideIcons || {};

// Inline categories to avoid import issues
interface Category {
  id: string;
  name: string;
  description: string;
}

const KNOWLEDGE_CATEGORIES: Category[] = [
  {
    id: 'clients',
    name: 'Klienter',
    description: 'Information om klienter, investerare och affärsrelationer',
  },
  {
    id: 'negotiations',
    name: 'Förhandlingar',
    description: 'Förhandlingshistorik, avtal och affärsvillkor',
  },
  {
    id: 'compliance',
    name: 'Compliance',
    description: 'Regulatoriska frågor, policyer och riktlinjer',
  },
  {
    id: 'internal',
    name: 'Intern',
    description: 'Interna processer, rutiner och företagsinformation',
  },
];

interface KnowledgeItem {
  knowledgeId: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  sharedByUserId: string;
  sharedByEmail?: string;
  sharedByName?: string;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeStats {
  totalItems: number;
  byCategory: Record<string, number>;
}

// Helper function to get category icon safely (avoids undefined)
function getCategoryIcon(categoryId: string): React.ReactElement {
  const IconComponent = (() => {
    switch (categoryId) {
      case 'clients': return Users;
      case 'negotiations': return Handshake;
      case 'compliance': return Shield;
      case 'internal': return Building2;
      default: return BookOpen;
    }
  })();
  
  // Extra safety
  if (!IconComponent) {
    return <span className="w-5 h-5" />;
  }
  
  return <IconComponent className="w-5 h-5" />;
}

const CATEGORY_COLORS: Record<string, string> = {
  clients: 'bg-aifm-gold/10 border-aifm-gold/20 text-aifm-charcoal',
  negotiations: 'bg-aifm-charcoal/[0.06] border-aifm-charcoal/10 text-aifm-charcoal',
  compliance: 'bg-aifm-gold/15 border-aifm-gold/25 text-aifm-charcoal',
  internal: 'bg-aifm-charcoal/[0.04] border-aifm-charcoal/10 text-aifm-charcoal',
};

const DEFAULT_CATEGORY_COLOR = 'bg-aifm-charcoal/[0.04] border-gray-100 text-aifm-charcoal';

export default function KnowledgePage() {
  const router = useRouter();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadKnowledge = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ stats: 'true', limit: '100' });
      if (selectedCategory) {
        params.set('category', selectedCategory);
      }
      
      const response = await fetch(`/api/knowledge?${params}`);
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (error) {
      console.error('Failed to load knowledge:', error);
    }
    setIsLoading(false);
  }, [selectedCategory]);

  // Get current user
  useEffect(() => {
    const getUserInfo = async () => {
      try {
        const response = await fetch('/api/profile');
        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data.userId);
        }
      } catch {
        // Ignore errors
      }
    };
    getUserInfo();
  }, []);

  useEffect(() => {
    loadKnowledge();
  }, [loadKnowledge]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadKnowledge();
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: searchQuery,
          category: selectedCategory,
          limit: 50,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setItems(data.results?.map((r: { item: KnowledgeItem }) => r.item) || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
    setIsLoading(false);
  };

  const handleDelete = async (item: KnowledgeItem) => {
    if (!confirm('Är du säker på att du vill ta bort denna kunskap?')) return;
    
    setDeletingItem(item.knowledgeId);
    try {
      const response = await fetch(
        `/api/knowledge?category=${item.category}&knowledgeId=${item.knowledgeId}`,
        { method: 'DELETE' }
      );
      
      if (response.ok) {
        setItems(items.filter(i => i.knowledgeId !== item.knowledgeId));
      } else {
        const data = await response.json();
        alert(data.error || 'Kunde inte ta bort');
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
    setDeletingItem(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getCategoryInfo = (categoryId: string): Category | undefined => {
    return KNOWLEDGE_CATEGORIES.find(c => c.id === categoryId);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link 
                href="/chat" 
                className="p-2 hover:bg-aifm-charcoal/[0.04] rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-aifm-charcoal/50" />
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Kunskapsbas</h1>
                <p className="text-sm text-aifm-charcoal/40">Teamets delade kunskap</p>
              </div>
            </div>
            
            <Link
              href="/chat"
              className="flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Tillbaka till chatten</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
              <div className="text-2xl font-semibold tracking-tight text-aifm-charcoal">{stats.totalItems}</div>
              <div className="text-sm text-aifm-charcoal/40">Totalt delad kunskap</div>
            </div>
            {KNOWLEDGE_CATEGORIES.map(cat => (
              <div 
                key={cat.id}
                className={`rounded-2xl p-4 border ${CATEGORY_COLORS[cat.id] || DEFAULT_CATEGORY_COLOR} cursor-pointer hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300`}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  {getCategoryIcon(cat.id)}
                  <span className="font-medium">{cat.name}</span>
                </div>
                <div className="text-2xl font-semibold tracking-tight">{stats.byCategory[cat.id] || 0}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search and Filter */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Sök i kunskapsbasen..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
              />
            </div>
            
            <div className="flex gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-full text-sm transition-all ${
                    selectedCategory 
                      ? 'border-aifm-gold bg-aifm-gold/10 text-aifm-charcoal' 
                      : 'border-gray-200 hover:border-gray-300 text-aifm-charcoal/50 hover:text-aifm-charcoal'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  <span>{selectedCategory ? getCategoryInfo(selectedCategory)?.name : 'Alla kategorier'}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                
                {showCategoryFilter && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl border border-gray-100 shadow-lg z-20">
                    <button
                      onClick={() => { setSelectedCategory(null); setShowCategoryFilter(false); }}
                      className="w-full px-4 py-2.5 text-left hover:bg-aifm-charcoal/[0.03] text-sm rounded-t-xl transition-colors"
                    >
                      Alla kategorier
                    </button>
                    {KNOWLEDGE_CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => { setSelectedCategory(cat.id); setShowCategoryFilter(false); }}
                        className={`w-full px-4 py-2.5 text-left hover:bg-aifm-charcoal/[0.03] text-sm flex items-center gap-2 transition-colors ${
                          selectedCategory === cat.id ? 'bg-aifm-charcoal/[0.03]' : ''
                        }`}
                      >
                        {getCategoryIcon(cat.id)}
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <button
                onClick={handleSearch}
                className="px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm"
              >
                Sök
              </button>
              
              <button
                onClick={loadKnowledge}
                className="p-2.5 border border-gray-200 rounded-full hover:border-gray-300 transition-all"
                title="Uppdatera"
              >
                <RefreshCw className="w-5 h-5 text-aifm-charcoal/40" />
              </button>
            </div>
          </div>
          
          {selectedCategory && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-aifm-charcoal/40">Filter:</span>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${CATEGORY_COLORS[selectedCategory || ''] || DEFAULT_CATEGORY_COLOR}`}>
                {getCategoryIcon(selectedCategory)}
                {getCategoryInfo(selectedCategory)?.name}
                <button 
                  onClick={() => setSelectedCategory(null)}
                  className="ml-1 hover:opacity-70"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            </div>
          )}
        </div>

        {/* Knowledge Items */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <BookOpen className="w-12 h-12 text-aifm-charcoal/10 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-aifm-charcoal tracking-tight mb-2">Ingen kunskap hittades</h3>
            <p className="text-aifm-charcoal/40 max-w-md mx-auto">
              {searchQuery 
                ? 'Inga resultat matchade din sökning. Prova att ändra sökorden.'
                : 'Börja dela kunskap från chatten genom att klicka på "Dela"-knappen på AI-svar.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map(item => {
              const category = getCategoryInfo(item.category);
              const isExpanded = expandedItem === item.knowledgeId;
              const isOwner = currentUserId === item.sharedByUserId;
              
              return (
                <div
                  key={item.knowledgeId}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300"
                >
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedItem(isExpanded ? null : item.knowledgeId)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${CATEGORY_COLORS[item.category] || DEFAULT_CATEGORY_COLOR}`}>
                            {getCategoryIcon(item.category)}
                            {category?.name}
                          </span>
                          {item.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-aifm-gold/15 text-aifm-charcoal rounded-full text-xs font-medium">
                              <Tag className="w-3 h-3" />
                              {tag}
                            </span>
                          ))}
                        </div>
                        
                        <h3 className="font-medium text-aifm-charcoal mb-1">{item.title}</h3>
                        
                        <p className="text-sm text-aifm-charcoal/50 line-clamp-2">
                          {item.content}
                        </p>
                        
                        <div className="flex items-center gap-4 mt-3 text-xs text-aifm-charcoal/40">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {item.sharedByName || item.sharedByEmail || 'Anonym'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(item.createdAt)}
                          </span>
                        </div>
                      </div>
                      
                      <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                      <div className="bg-aifm-charcoal/[0.03] rounded-xl p-4 text-sm text-aifm-charcoal/70 whitespace-pre-wrap">
                        {item.content}
                      </div>
                      
                      {isOwner && (
                        <div className="flex justify-end gap-2 mt-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                            disabled={deletingItem === item.knowledgeId}
                            className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-full transition-colors text-sm disabled:opacity-50"
                          >
                            {deletingItem === item.knowledgeId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            Ta bort
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
