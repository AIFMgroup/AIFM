'use client';

import { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { useToast } from '@/components/Toast';

// Destructure icons with fallbacks
const { 
  X = () => null, 
  Share2 = () => null, 
  Users = () => null, 
  Handshake = () => null, 
  Shield = () => null, 
  Building2 = () => null,
  Tag = () => null,
  Check = () => null,
  Loader2 = () => null,
  BookOpen = () => null,
  AlertCircle = () => null,
  Sparkles = () => null,
} = LucideIcons || {};

// Inline categories to avoid any import issues
const KNOWLEDGE_CATEGORIES = [
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

interface ShareToKnowledgeBaseProps {
  isOpen: boolean;
  onClose: () => void;
  messageContent: string;
  messageId?: string;
  sessionId?: string;
  onSuccess?: () => void;
}

// Helper function to get category icon safely - uses inline check
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
  
  // Extra safety: if icon component is null/undefined, return empty span
  if (!IconComponent) {
    return <span className="w-5 h-5" />;
  }
  
  return <IconComponent className="w-5 h-5" />;
}

const CATEGORY_COLORS: Record<string, string> = {
  clients: 'bg-blue-50 border-blue-200 hover:bg-blue-100 data-[selected=true]:bg-blue-100 data-[selected=true]:border-blue-400',
  negotiations: 'bg-green-50 border-green-200 hover:bg-green-100 data-[selected=true]:bg-green-100 data-[selected=true]:border-green-400',
  compliance: 'bg-purple-50 border-purple-200 hover:bg-purple-100 data-[selected=true]:bg-purple-100 data-[selected=true]:border-purple-400',
  internal: 'bg-orange-50 border-orange-200 hover:bg-orange-100 data-[selected=true]:bg-orange-100 data-[selected=true]:border-orange-400',
};

// Default fallback color
const DEFAULT_CATEGORY_COLOR = 'bg-gray-50 border-gray-200 hover:bg-gray-100 data-[selected=true]:bg-gray-100 data-[selected=true]:border-gray-400';

export function ShareToKnowledgeBase({
  isOpen,
  onClose,
  messageContent,
  messageId,
  sessionId,
  onSuccess,
}: ShareToKnowledgeBaseProps) {
  const toast = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isAutoCategorizing, setIsAutoCategorizing] = useState(false);

  // Auto-categorize using AI when modal opens
  const autoCategorize = async (text: string) => {
    setIsAutoCategorizing(true);
    try {
      const response = await fetch('/api/knowledge/auto-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.category) {
          setSelectedCategory(data.category);
        }
        if (data.suggestedTitle) {
          setTitle(data.suggestedTitle);
        }
        if (data.suggestedTags && data.suggestedTags.length > 0) {
          setTags(data.suggestedTags);
        }
      }
    } catch (err) {
      // Silent fail - user can still manually select
      console.error('Auto-categorize failed:', err);
    }
    setIsAutoCategorizing(false);
  };

  // Initialize content from message
  useEffect(() => {
    if (isOpen) {
      setContent(messageContent);
      // Generate a title from first line or first 50 chars
      const firstLine = messageContent.split('\n')[0].replace(/^#+\s*/, '');
      setTitle(firstLine.slice(0, 80) + (firstLine.length > 80 ? '...' : ''));
      setSelectedCategory('');
      setTags([]);
      setTagInput('');
      setError(null);
      setSuccess(false);
      
      // Auto-categorize
      autoCategorize(messageContent);
    }
  }, [isOpen, messageContent]);

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async () => {
    if (!selectedCategory) {
      setError('Välj en kategori');
      return;
    }
    if (!title.trim()) {
      setError('Ange en titel');
      return;
    }
    if (!content.trim()) {
      setError('Innehållet kan inte vara tomt');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selectedCategory,
          title: title.trim(),
          content: content.trim(),
          tags,
          sourceMessageId: messageId,
          sourceSessionId: sessionId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Kunde inte dela till kunskapsbasen');
      }

      const categoryName = KNOWLEDGE_CATEGORIES.find(c => c.id === selectedCategory)?.name || selectedCategory;
      
      setSuccess(true);
      toast.success(
        'Delat till kunskapsbasen!', 
        `"${title.slice(0, 30)}${title.length > 30 ? '...' : ''}" sparades i ${categoryName}`
      );
      
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ett fel uppstod';
      setError(errorMessage);
      toast.error('Kunde inte dela', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#2d2a26] to-[#4a4540] p-5 text-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Dela till kunskapsbasen</h2>
                <p className="text-sm text-white/70">Gör denna insikt tillgänglig för hela teamet</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Category Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Välj kategori *
              </label>
              {isAutoCategorizing && (
                <span className="flex items-center gap-1.5 text-xs text-violet-600">
                  <Sparkles className="w-3 h-3 animate-pulse" />
                  AI föreslår...
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {KNOWLEDGE_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  data-selected={selectedCategory === category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${CATEGORY_COLORS[category.id] || DEFAULT_CATEGORY_COLOR}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {getCategoryIcon(category.id)}
                    <span className="font-medium">{category.name}</span>
                    {selectedCategory === category.id && (
                      <Check className="w-4 h-4 ml-auto text-green-600" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{category.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titel *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kort beskrivande titel..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280]/50 focus:border-[#c0a280]"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Innehåll *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280]/50 focus:border-[#c0a280] text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Du kan redigera innehållet innan du delar
            </p>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Taggar (valfritt)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Lägg till tagg..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280]/50 focus:border-[#c0a280] text-sm"
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 transition-colors"
              >
                Lägg till
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg">
              <Check className="w-4 h-4" />
              <span className="text-sm">Delat till kunskapsbasen!</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-gray-50 border-t flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || success}
            className="px-6 py-2 bg-[#2d2a26] text-white rounded-lg hover:bg-[#4a4540] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Delar...
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                Dela till kunskapsbas
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
