'use client';

import { useState, useEffect } from 'react';
import {
  BookOpen,
  Loader2,
  Trash2,
  Edit2,
  Check,
  X,
  Filter,
} from 'lucide-react';
import { KNOWLEDGE_CATEGORIES, getCategoryName } from '@/lib/knowledge/categories';

interface KnowledgeItem {
  knowledgeId: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  sharedByUserId: string;
  sharedByEmail?: string;
  sharedByName?: string;
  sourceSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

export default function KnowledgeReviewPage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('auto-learned');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const url = categoryFilter
        ? `/api/knowledge?category=${encodeURIComponent(categoryFilter)}&limit=200`
        : '/api/knowledge?limit=200';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Kunde inte ladda');
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [categoryFilter]);

  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    const item = items.find((i) => i.knowledgeId === editingId);
    if (!item) return;
    try {
      const res = await fetch('/api/knowledge', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: item.category,
          knowledgeId: item.knowledgeId,
          title: editContent.slice(0, 100) + (editContent.length > 100 ? '...' : ''),
          content: editContent,
        }),
      });
      if (!res.ok) throw new Error('Kunde inte spara');
      setItems((prev) =>
        prev.map((i) =>
          i.knowledgeId === editingId
            ? { ...i, content: editContent, title: editContent.slice(0, 100) }
            : i
        )
      );
      setEditingId(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Kunde inte spara');
    }
  };

  const handleDelete = async (item: KnowledgeItem) => {
    if (!confirm('Ta bort denna kunskapspost?')) return;
    setDeletingId(item.knowledgeId);
    try {
      const res = await fetch(
        `/api/knowledge?category=${encodeURIComponent(item.category)}&knowledgeId=${encodeURIComponent(item.knowledgeId)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Kunde inte ta bort');
      setItems((prev) => prev.filter((i) => i.knowledgeId !== item.knowledgeId));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Kunde inte ta bort');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-aifm-charcoal flex items-center gap-2">
          <BookOpen className="w-7 h-7" />
          Granska kunskap
        </h1>
        <p className="text-sm text-aifm-charcoal/60 mt-1">
          AI-extraherade insikter och delad kunskap. Redigera eller ta bort poster.
        </p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-aifm-charcoal/50" />
          <span className="text-sm text-aifm-charcoal/60">Kategori:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold"
          >
            <option value="">Alla</option>
            {KNOWLEDGE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-aifm-gold animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-aifm-charcoal/50">
          Inga kunskapsposter i denna kategori.
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li
              key={item.knowledgeId}
              className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-medium text-aifm-charcoal/50 uppercase tracking-wider">
                      {getCategoryName(item.category)}
                    </span>
                    {item.sourceSessionId && (
                      <span className="text-xs text-aifm-charcoal/40">
                        Chatt: {item.sourceSessionId.slice(0, 8)}…
                      </span>
                    )}
                    {item.sharedByEmail && (
                      <span className="text-xs text-aifm-charcoal/40">{item.sharedByEmail}</span>
                    )}
                  </div>
                  {editingId === item.knowledgeId ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-aifm-charcoal rounded-lg hover:bg-aifm-charcoal/90"
                        >
                          <Check className="w-4 h-4" />
                          Spara
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditContent(''); }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-aifm-charcoal border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          <X className="w-4 h-4" />
                          Avbryt
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-aifm-charcoal whitespace-pre-wrap">{item.content}</p>
                  )}
                </div>
                {editingId !== item.knowledgeId && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.knowledgeId);
                        setEditContent(item.content);
                      }}
                      className="p-2 text-aifm-charcoal/50 hover:text-aifm-gold hover:bg-aifm-gold/10 rounded-lg"
                      aria-label="Redigera"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.knowledgeId}
                      className="p-2 text-aifm-charcoal/50 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                      aria-label="Ta bort"
                    >
                      {deletingId === item.knowledgeId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
