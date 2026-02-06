'use client';

import { BookOpen } from 'lucide-react';

interface KnowledgeIndicatorProps {
  isShared: boolean;
  category?: string;
  onClick?: () => void;
}

export function KnowledgeIndicator({ isShared, category, onClick }: KnowledgeIndicatorProps) {
  if (!isShared) return null;

  const categoryColors: Record<string, string> = {
    clients: 'bg-blue-100 text-blue-600',
    negotiations: 'bg-green-100 text-green-600',
    compliance: 'bg-purple-100 text-purple-600',
    internal: 'bg-orange-100 text-orange-600',
  };

  const colorClass = category ? categoryColors[category] || 'bg-gray-100 text-gray-600' : 'bg-gray-100 text-gray-600';

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${colorClass} hover:opacity-80 transition-opacity`}
      title="Delad till kunskapsbasen"
    >
      <BookOpen className="w-3 h-3" />
      <span>Delad</span>
    </button>
  );
}
