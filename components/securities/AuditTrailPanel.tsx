'use client';

import {
  FileText,
  Send,
  CheckCircle2,
  XCircle,
  HelpCircle,
  MessageSquare,
  RefreshCw,
  Calendar,
  User,
} from 'lucide-react';
import type { AuditEntry } from '@/lib/integrations/securities/types';

interface AuditTrailPanelProps {
  auditTrail: AuditEntry[] | undefined;
}

const ACTION_CONFIG: Record<
  AuditEntry['action'],
  { label: string; icon: typeof FileText; color: string }
> = {
  created: { label: 'Skapad', icon: FileText, color: 'text-gray-600 bg-gray-100' },
  submitted: { label: 'Inskickad', icon: Send, color: 'text-blue-600 bg-blue-100' },
  approved: { label: 'Godkänd', icon: CheckCircle2, color: 'text-green-600 bg-green-100' },
  rejected: { label: 'Avvisad', icon: XCircle, color: 'text-red-600 bg-red-100' },
  info_requested: { label: 'Komplettering begärd', icon: HelpCircle, color: 'text-amber-600 bg-amber-100' },
  info_responded: { label: 'Svar skickat', icon: Send, color: 'text-amber-600 bg-amber-100' },
  comment_added: { label: 'Kommentar', icon: MessageSquare, color: 'text-indigo-600 bg-indigo-100' },
  renewed: { label: 'Förnyad', icon: RefreshCw, color: 'text-green-600 bg-green-100' },
  expired: { label: 'Utgången', icon: Calendar, color: 'text-gray-500 bg-gray-100' },
};

function formatAuditTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AuditTrailPanel({ auditTrail }: AuditTrailPanelProps) {
  const entries = auditTrail ?? [];
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-aifm-charcoal/60" />
          <span className="text-sm font-medium text-aifm-charcoal">Historik</span>
        </div>
        <p className="px-4 py-3 text-sm text-gray-500">Ingen historik tillgänglig.</p>
      </div>
    );
  }

  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
        <RefreshCw className="w-4 h-4 text-aifm-charcoal/60" />
        <span className="text-sm font-medium text-aifm-charcoal">Historik</span>
        <span className="text-xs text-gray-400">({sorted.length})</span>
      </div>
      <div className="px-4 py-3 max-h-64 overflow-y-auto">
        <ul className="relative space-y-0">
          {sorted.map((entry, index) => {
            const config = ACTION_CONFIG[entry.action] ?? {
              label: entry.action,
              icon: FileText,
              color: 'text-gray-600 bg-gray-100',
            };
            const Icon = config.icon;
            const isLast = index === sorted.length - 1;
            return (
              <li key={`${entry.timestamp}-${entry.action}-${index}`} className="relative flex gap-3 pb-4">
                {!isLast && (
                  <span
                    className="absolute left-[11px] top-6 bottom-0 w-px bg-gray-200"
                    aria-hidden
                  />
                )}
                <div
                  className={`relative z-0 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${config.color}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-aifm-charcoal">{config.label}</span>
                    <span className="text-xs text-gray-500">
                      {formatAuditTime(entry.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                    <User className="w-3 h-3" />
                    <span>{entry.actor}</span>
                    {entry.actorEmail && (
                      <span className="text-gray-400">({entry.actorEmail})</span>
                    )}
                  </div>
                  {entry.details && (
                    <p className="mt-1.5 text-sm text-aifm-charcoal/70 whitespace-pre-wrap line-clamp-3">
                      {entry.details}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
