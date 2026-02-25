'use client';

import { useState } from 'react';
import { MessageSquare, Send, Loader2, User } from 'lucide-react';
import type { ApprovalComment } from '@/lib/integrations/securities/types';

interface ApprovalDiscussionProps {
  approvalId: string;
  comments: ApprovalComment[] | undefined;
  currentUserName: string;
  currentUserEmail: string;
  currentUserRole: 'forvaltare' | 'operation';
  onCommentAdded?: () => void;
}

function formatCommentTime(createdAt: string): string {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMin < 1) return 'Just nu';
  if (diffMin < 60) return `${diffMin} min sedan`;
  if (diffHours < 24) return `${diffHours} tim sedan`;
  if (diffDays === 1) return 'Igår';
  return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ApprovalDiscussion({
  approvalId,
  comments,
  currentUserName,
  currentUserEmail,
  currentUserRole,
  onCommentAdded,
}: ApprovalDiscussionProps) {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const msg = newMessage.trim();
    if (!msg || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/securities/approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: approvalId,
          action: 'add_comment',
          author: currentUserName,
          authorEmail: currentUserEmail,
          role: currentUserRole,
          message: msg,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Kunde inte skicka kommentar');
      }
      setNewMessage('');
      onCommentAdded?.();
    } catch (e) {
      console.error('Send comment error:', e);
      alert(e instanceof Error ? e.message : 'Något gick fel');
    } finally {
      setSending(false);
    }
  };

  const list = comments ?? [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-aifm-charcoal/60" />
        <span className="text-sm font-medium text-aifm-charcoal">Diskussion</span>
        {list.length > 0 && (
          <span className="text-xs text-gray-400">({list.length})</span>
        )}
      </div>
      <div className="max-h-48 overflow-y-auto">
        {list.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-500">Inga kommentarer än.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {list.map((c) => (
              <li key={c.id} className="px-4 py-2.5">
                <div className="flex items-start gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      c.role === 'operation' ? 'bg-aifm-gold/20 text-aifm-gold' : 'bg-aifm-charcoal/10 text-aifm-charcoal/70'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-aifm-charcoal">{c.author}</span>
                      <span className="text-xs text-gray-400">
                        {c.role === 'operation' ? 'Operations' : 'Förvaltare'}
                      </span>
                      <span className="text-xs text-gray-400">{formatCommentTime(c.createdAt)}</span>
                    </div>
                    <p className="text-sm text-aifm-charcoal/80 whitespace-pre-wrap mt-0.5">{c.message}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="p-3 border-t border-gray-100 flex gap-2">
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={2}
          placeholder="Skriv en kommentar..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold resize-none"
          disabled={sending}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!newMessage.trim() || sending}
          className="self-end flex items-center gap-1.5 px-3 py-2 bg-aifm-charcoal text-white rounded-lg text-sm font-medium hover:bg-aifm-charcoal/90 disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Skicka
        </button>
      </div>
    </div>
  );
}
