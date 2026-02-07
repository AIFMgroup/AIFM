'use client';

import { useState, useRef, useEffect, useCallback, useMemo, memo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { 
  Send, 
  Copy,
  Check,
  Sparkles,
  Bot,
  BookOpen,
  Loader2,
  User,
  Trash2,
  Shield,
  Paperclip,
  X,
  FileText,
  FileSpreadsheet,
  File,
  MessageSquare,
  Plus,
  ChevronRight,
  Clock,
  ExternalLink,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Search,
  LayoutDashboard,
  Menu,
  ChevronLeft,
  Mic,
  MicOff,
  Share2,
  BarChart3,
  BookMarked,
  Sun,
  Moon,
  Minimize2,
  Maximize2,
  Briefcase,
  Download,
  Link2,
  Globe,
  Languages,
  MoreHorizontal,
  Wand2,
  Volume2,
  VolumeX,
  Users,
  Pin,
  PinOff,
  Quote,
  ListChecks,
  GitBranch,
  Pencil,
  Bell,
} from 'lucide-react';
import { ShareToKnowledgeBase } from '@/components/chat/ShareToKnowledgeBase';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { usePrefersDarkMode, useIsStandalone, useIsMobile } from '@/hooks/useMediaQuery';
import { MobileBottomNav } from '@/components/MobileNav';
import { TemplateSelector, type TemplateId } from '@/components/chat/TemplateSelector';
import { MermaidDiagram } from '@/components/chat/MermaidDiagram';

// ============================================================================
// Focus trap hook for modal dialogs
// ============================================================================
function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length) focusable[0].focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    el.addEventListener('keydown', handleKeyDown);
    return () => {
      el.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [active]);
  return ref;
}

// ============================================================================
// Types
// ============================================================================

type AgentMode = 'claude';

interface InternalKnowledgeSource {
  id: string;
  title: string;
  category: string;
  sharedBy: string;
  sharedAt: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  internalSources?: InternalKnowledgeSource[];
  confidence?: number;
  timestamp: string;
  mode: AgentMode;
  attachments?: AttachedFile[];
  feedback?: 'positive' | 'negative' | null;
  senderName?: string; // For shared sessions - who sent this message
}

interface AttachedFile {
  name: string;
  type: string;
  size: number;
  content?: string;
  preview?: string; // Base64 image preview for images
}

interface Citation {
  documentTitle: string;
  documentNumber?: string;
  section?: string;
  excerpt: string;
  sourceUrl: string;
}

/** A conversation branch: fork at a message, then messages continue from there */
interface ChatBranch {
  branchId: string;
  parentMessageId: string;
  messages: Message[];
  createdAt: string;
}

interface ChatSession {
  sessionId: string;
  title: string;
  mode: AgentMode;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  pinnedAt?: string;
  tags?: string[];
  branches?: ChatBranch[];
}

interface ChatInvitation {
  invitationId: string;
  senderName: string;
  senderEmail: string;
  shareCode: string;
  sessionTitle: string;
  status: 'pending' | 'accepted' | 'dismissed';
  createdAt: string;
}

// ============================================================================
// Constants
// ============================================================================

const EXAMPLE_QUESTIONS: string[] = [
  'Hur beräknas NAV?',
  'Förklara KIID-kraven',
  'Skillnad mellan UCITS och AIF',
  'Vilka krav gäller för AIFM Annex IV?',
  'Vad säger FFFS 2013:10?',
];

const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
];

/** Process a single file into an attachment: validates, creates preview, parses via API. Throws on failure. */
async function processFileAttachment(file: File): Promise<{ name: string; type: string; size: number; content: string; preview?: string }> {
  // Create base64 preview for images
  let previewDataUrl: string | undefined;
  if (file.type.startsWith('image/')) {
    previewDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/ai/parse-file', { method: 'POST', body: formData });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.details || 'Kunde inte läsa filen');
  }

  const data = await response.json();

  // For images the vision API analyses the image, so short OCR text is fine
  const isImage = file.type.startsWith('image/');
  if (!isImage && (!data.content || data.content.length < 10)) {
    throw new Error(`Filen "${file.name}" kunde inte läsas. Innehållet verkar vara tomt.`);
  }

  return {
    name: file.name,
    type: file.type,
    size: file.size,
    content: data.content || '[Bild för visuell analys]',
    preview: previewDataUrl,
  };
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function isFileTypeSupported(file: File): boolean {
  return SUPPORTED_FILE_TYPES.includes(file.type) ||
    file.name.endsWith('.txt') ||
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls') ||
    file.name.endsWith('.csv') ||
    file.name.endsWith('.pdf') ||
    file.name.endsWith('.docx') ||
    file.name.endsWith('.png') ||
    file.name.endsWith('.jpg') ||
    file.name.endsWith('.jpeg') ||
    file.name.endsWith('.webp');
}

/** Shared SSE stream reader for /api/ai/chat. Calls onChunk for each text update; returns final content and metadata. */
async function streamAssistantResponse(
  response: Response,
  onChunk: (params: { fullContent: string; citations: Citation[]; internalSources: InternalKnowledgeSource[] }) => void
): Promise<{ fullContent: string; citations: Citation[]; internalSources: InternalKnowledgeSource[] }> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let citations: Citation[] = [];
  let internalSources: InternalKnowledgeSource[] = [];
  if (!reader) return { fullContent, citations, internalSources };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.meta) {
            if (parsed.citations) citations = parsed.citations;
            if (parsed.internalSources) internalSources = parsed.internalSources;
          }
          if (parsed.done && parsed.citations) citations = parsed.citations;
          const textChunk = parsed.text ?? parsed.content;
          if (textChunk) {
            fullContent += textChunk;
            onChunk({ fullContent, citations, internalSources });
          }
          if (parsed.error) throw new Error(parsed.error);
        } catch (e) {
          if (e instanceof Error && e.message !== 'Unexpected') throw e;
        }
      }
    }
  }
  return { fullContent, citations, internalSources };
}

// ============================================================================
// Code Block with Copy Button
// ============================================================================

function CodeBlockWithCopy({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  
  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <span className="relative inline-flex items-center group">
      <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-[#2d2a26]">
        {code}
      </code>
      <button
        onClick={copyCode}
        className="ml-1 p-0.5 rounded text-gray-300 hover:text-[#c0a280] hover:bg-gray-100 
                   opacity-0 group-hover:opacity-100 transition-all"
        title="Kopiera kod"
        aria-label="Kopiera kod"
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-500" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </button>
    </span>
  );
}

// ============================================================================
// Markdown Formatter
// ============================================================================

// Helper to check if a line is a table row
function isTableRow(line: string): boolean {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
}

// Helper to check if a line is a table separator (|---|---|)
function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:]+\|/.test(line.trim()) && line.includes('-');
}

// Helper to parse table cells from a row
function parseTableCells(row: string): string[] {
  return row
    .split('|')
    .slice(1, -1) // Remove first and last empty elements
    .map(cell => cell.trim());
}

// Render a markdown table as HTML
function renderTable(tableLines: string[], startIndex: number): React.ReactNode {
  const rows: string[][] = [];
  let hasHeader = false;
  let headerEndIndex = -1;
  
  tableLines.forEach((line, idx) => {
    if (isTableSeparator(line)) {
      hasHeader = true;
      headerEndIndex = idx;
    } else if (isTableRow(line)) {
      rows.push(parseTableCells(line));
    }
  });
  
  if (rows.length === 0) return null;
  
  const headerRows = hasHeader ? rows.slice(0, headerEndIndex) : [];
  const bodyRows = hasHeader ? rows.slice(headerEndIndex) : rows;
  
  return (
    <div key={`table-${startIndex}`} className="my-3 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        {headerRows.length > 0 && (
          <thead>
            {headerRows.map((row, rowIdx) => (
              <tr key={`thead-${rowIdx}`} className="bg-[#f5f0e8] border-b border-[#d4c5b0]">
                {row.map((cell, cellIdx) => (
                  <th 
                    key={`th-${rowIdx}-${cellIdx}`}
                    className="px-3 py-2 text-left font-semibold text-[#2d2a26] border border-[#d4c5b0]"
                  >
                    {formatInlineMarkdown(cell)}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
        )}
        <tbody>
          {bodyRows.map((row, rowIdx) => (
            <tr 
              key={`tbody-${rowIdx}`} 
              className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#faf8f5]'}
            >
              {row.map((cell, cellIdx) => (
                <td 
                  key={`td-${rowIdx}-${cellIdx}`}
                  className="px-3 py-2 text-[#2d2a26] border border-[#d4c5b0]"
                >
                  {formatInlineMarkdown(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Check if this is the start of a table
    if (isTableRow(line)) {
      const tableLines: string[] = [];
      const tableStartIndex = i;
      
      // Collect all consecutive table lines
      while (i < lines.length && (isTableRow(lines[i]) || isTableSeparator(lines[i]))) {
        tableLines.push(lines[i]);
        i++;
      }
      
      // Render the table
      const table = renderTable(tableLines, tableStartIndex);
      if (table) {
        elements.push(table);
      }
      continue;
    }
    
    // Check for Mermaid diagram code block
    if (line.trim().startsWith('```mermaid')) {
      const mermaidLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        mermaidLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      const code = mermaidLines.join('\n').trim();
      if (code) {
        elements.push(<MermaidDiagram key={`mermaid-${i}-${elements.length}`} code={code} />);
      }
      continue;
    }
    
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      elements.push(
        <span key={`h1-${i}`} className="font-bold text-[#2d2a26] text-base block mt-4 mb-2">
          {formatInlineMarkdown(line.slice(2))}
        </span>
      );
    }
    else if (line.startsWith('## ') && !line.startsWith('### ')) {
      elements.push(
        <span key={`h2-${i}`} className="font-semibold text-[#2d2a26] block mt-3 mb-1">
          {formatInlineMarkdown(line.slice(3))}
        </span>
      );
    }
    else if (line.startsWith('### ') && !line.startsWith('#### ')) {
      elements.push(
        <span key={`h3-${i}`} className="font-semibold text-[#2d2a26] block mt-2 mb-1">
          {formatInlineMarkdown(line.slice(4))}
        </span>
      );
    }
    else if (line.startsWith('#### ') && !line.startsWith('##### ')) {
      elements.push(
        <span key={`h4-${i}`} className="font-semibold text-[#2d2a26] text-sm block mt-2 mb-1">
          {formatInlineMarkdown(line.slice(5))}
        </span>
      );
    }
    else if (line.startsWith('##### ')) {
      elements.push(
        <span key={`h5-${i}`} className="font-medium text-[#2d2a26] text-sm block mt-1.5 mb-0.5">
          {formatInlineMarkdown(line.slice(6))}
        </span>
      );
    }
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <span key={`li-${i}`} className="block ml-3">
          • {formatInlineMarkdown(line.slice(2))}
        </span>
      );
    }
    else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        elements.push(
          <span key={`ol-${i}`} className="block ml-3">
            {match[1]}. {formatInlineMarkdown(match[2])}
          </span>
        );
      }
    }
    else if (line.trim()) {
      elements.push(
        <span key={`p-${i}`} className="block">
          {formatInlineMarkdown(line)}
        </span>
      );
    }
    else {
      elements.push(<span key={`br-${i}`} className="block h-2" />);
    }
    
    i++;
  }
  
  return elements;
}

function formatInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;
  
  while (remaining.length > 0) {
    const linkMatch = remaining.match(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/);
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const codeMatch = remaining.match(/`([^`]+)`/);
    const plainUrlMatch = remaining.match(/(?<!\]\()https?:\/\/[^\s<>\)\]]+/);
    
    const matches = [
      { type: 'link', match: linkMatch, index: linkMatch?.index ?? Infinity },
      { type: 'bold', match: boldMatch, index: boldMatch?.index ?? Infinity },
      { type: 'code', match: codeMatch, index: codeMatch?.index ?? Infinity },
      { type: 'plainUrl', match: plainUrlMatch, index: plainUrlMatch?.index ?? Infinity },
    ].filter(m => m.match !== null).sort((a, b) => a.index - b.index);
    
    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }
    
    const first = matches[0];
    
    if (first.index > 0) {
      parts.push(remaining.slice(0, first.index));
    }
    
    if (first.type === 'link' && first.match) {
      const [fullMatch, linkText, linkUrl] = first.match;
      const cleanUrl = linkUrl.replace(/[.,;:!?]+$/, '');
      parts.push(
        <a 
          key={`link-${keyIndex++}`} 
          href={cleanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-[#c0a280] hover:text-[#8a7355] underline decoration-[#c0a280]/30 hover:decoration-[#c0a280] transition-colors"
          title={cleanUrl}
        >
          {linkText}
          <ExternalLink className="w-3 h-3 inline-block flex-shrink-0" />
        </a>
      );
      remaining = remaining.slice(first.index + fullMatch.length);
    } else if (first.type === 'plainUrl' && first.match) {
      const [url] = first.match;
      const cleanUrl = url.replace(/[.,;:!?]+$/, '');
      const trailingPunctuation = url.slice(cleanUrl.length);
      let displayText = cleanUrl;
      try {
        const urlObj = new URL(cleanUrl);
        displayText = urlObj.hostname.replace('www.', '');
      } catch {
        displayText = cleanUrl.length > 40 ? cleanUrl.slice(0, 40) + '...' : cleanUrl;
      }
      parts.push(
        <a 
          key={`url-${keyIndex++}`} 
          href={cleanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-[#c0a280] hover:text-[#8a7355] underline decoration-[#c0a280]/30 hover:decoration-[#c0a280] transition-colors"
          title={cleanUrl}
        >
          {displayText}
          <ExternalLink className="w-3 h-3 inline-block flex-shrink-0" />
        </a>
      );
      if (trailingPunctuation) {
        parts.push(trailingPunctuation);
      }
      remaining = remaining.slice(first.index + url.length);
    } else if (first.type === 'bold' && first.match) {
      parts.push(
        <strong key={`bold-${keyIndex++}`} className="font-semibold">
          {first.match[1]}
        </strong>
      );
      remaining = remaining.slice(first.index + first.match[0].length);
    } else if (first.type === 'code' && first.match) {
      parts.push(
        <CodeBlockWithCopy key={`code-${keyIndex++}`} code={first.match[1]} />
      );
      remaining = remaining.slice(first.index + first.match[0].length);
    }
  }
  
  return parts;
}

// ============================================================================
// Action Dropdown Menu Component
// ============================================================================

interface ActionDropdownProps {
  onRegenerate?: () => void;
  onReformulate?: (type: 'simplify' | 'expand' | 'formal') => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  isExporting: 'pdf' | 'excel' | null;
  isDarkMode?: boolean;
}

function ActionDropdown({ onRegenerate, onReformulate, onExportPDF, onExportExcel, isExporting, isDarkMode = false }: ActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative ml-auto" ref={dropdownRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`p-1.5 rounded-lg transition-all duration-200 ${
          isOpen 
            ? 'text-[#c0a280] bg-[#c0a280]/10' 
            : isDarkMode
              ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
        }`}
        title="Fler åtgärder"
        aria-label="Fler åtgärder"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className={`absolute right-0 bottom-full mb-2 w-56 rounded-xl shadow-xl border 
                     overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-100'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Share moved to quick-access button outside dropdown */}

          {/* Reformulate Section */}
          {onReformulate && (
            <>
              <div className={`px-4 py-2 ${isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                <span className={`text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  <Wand2 className="w-3 h-3" />
                  Omformulera
                </span>
              </div>
              <div className="py-1">
                <button
                  onClick={() => handleAction(() => onReformulate('simplify'))}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                    isDarkMode 
                      ? 'text-gray-300 hover:bg-blue-900/30 hover:text-blue-300'
                      : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  <Minimize2 className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />
                  <span>Förenkla svaret</span>
                </button>
                <button
                  onClick={() => handleAction(() => onReformulate('expand'))}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                    isDarkMode 
                      ? 'text-gray-300 hover:bg-purple-900/30 hover:text-purple-300'
                      : 'text-gray-600 hover:bg-purple-50 hover:text-purple-700'
                  }`}
                >
                  <Maximize2 className={`w-4 h-4 ${isDarkMode ? 'text-purple-400' : 'text-purple-500'}`} />
                  <span>Utveckla svaret</span>
                </button>
                <button
                  onClick={() => handleAction(() => onReformulate('formal'))}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                    isDarkMode 
                      ? 'text-gray-300 hover:bg-amber-900/30 hover:text-amber-300'
                      : 'text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                  }`}
                >
                  <Briefcase className={`w-4 h-4 ${isDarkMode ? 'text-amber-400' : 'text-amber-500'}`} />
                  <span>Gör formellt</span>
                </button>
              </div>
              <div className={`h-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`} />
            </>
          )}

          {/* Export Section */}
          <div className={`px-4 py-2 ${isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
            <span className={`text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
              isDarkMode ? 'text-gray-500' : 'text-gray-400'
            }`}>
              <Download className="w-3 h-3" />
              Exportera
            </span>
          </div>
          <div className="py-1">
            <button
              onClick={() => handleAction(onExportPDF)}
              disabled={isExporting !== null}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors disabled:opacity-50 ${
                isDarkMode 
                  ? 'text-gray-300 hover:bg-red-900/30 hover:text-red-300'
                  : 'text-gray-600 hover:bg-red-50 hover:text-red-700'
              }`}
            >
              {isExporting === 'pdf' ? (
                <Loader2 className={`w-4 h-4 animate-spin ${isDarkMode ? 'text-red-400' : 'text-red-500'}`} />
              ) : (
                <FileText className={`w-4 h-4 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`} />
              )}
              <span>Ladda ner som PDF</span>
            </button>
            <button
              onClick={() => handleAction(onExportExcel)}
              disabled={isExporting !== null}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors disabled:opacity-50 ${
                isDarkMode 
                  ? 'text-gray-300 hover:bg-green-900/30 hover:text-green-300'
                  : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
              }`}
            >
              {isExporting === 'excel' ? (
                <Loader2 className={`w-4 h-4 animate-spin ${isDarkMode ? 'text-green-400' : 'text-green-500'}`} />
              ) : (
                <FileSpreadsheet className={`w-4 h-4 ${isDarkMode ? 'text-green-400' : 'text-green-500'}`} />
              )}
              <span>Ladda ner som Excel</span>
            </button>
          </div>

          {/* Regenerate */}
          {onRegenerate && (
            <>
              <div className={`h-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`} />
              <button
                onClick={() => handleAction(onRegenerate)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
                  isDarkMode 
                    ? 'text-gray-300 hover:bg-[#c0a280]/20 hover:text-[#d4b896]'
                    : 'text-gray-600 hover:bg-[#c0a280]/10 hover:text-[#c0a280]'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Generera nytt svar</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Message Component - Mobile Optimized
// ============================================================================

interface MessageBubbleProps {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
  onShare?: (message: Message) => void;
  onFollowUp?: (question: string) => void;
  onReformulate?: (messageId: string, type: 'simplify' | 'expand' | 'formal') => void;
  onQuote?: (message: Message) => void;
  onStartBranch?: (messageId: string) => void;
  onStartEdit?: (messageId: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onCancelEdit?: () => void;
  editingMessageId?: string | null;
  isLastAssistantMessage?: boolean;
  isDarkMode?: boolean;
  isSharedSession?: boolean;
  showBranchAction?: boolean;
}

const MessageBubble = memo(function MessageBubble({ message, onRegenerate, onFeedback, onShare, onFollowUp, onReformulate, onQuote, onStartBranch, onStartEdit, onEditMessage, onCancelEdit, editingMessageId = null, isLastAssistantMessage, isDarkMode = false, isSharedSession = false, showBranchAction = false }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [localFeedback, setLocalFeedback] = useState<'positive' | 'negative' | null>(message.feedback || null);
  const [showActions, setShowActions] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [editDraft, setEditDraft] = useState(message.content);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isEditing = editingMessageId === message.id;
  useEffect(() => {
    if (isEditing) setEditDraft(message.content);
  }, [isEditing, message.content]);

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      if (utteranceRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Text-to-speech toggle
  const toggleSpeak = useCallback(() => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Strip markdown formatting for cleaner speech
    const cleanText = message.content
      .replace(/```[\s\S]*?```/g, ' kodblock utelämnat ')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/[|─┌┐└┘├┤┬┴┼]/g, '')
      .replace(/---+/g, '')
      .replace(/•\s*/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'sv-SE';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to find a Swedish voice
    const voices = window.speechSynthesis.getVoices();
    const svVoice = voices.find(v => v.lang.startsWith('sv')) || 
                    voices.find(v => v.lang.startsWith('en'));
    if (svVoice) {
      utterance.voice = svVoice;
    }

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [isSpeaking, message.content]);

  // Parse follow-up questions from the message content
  const parseFollowUpQuestions = (content: string): { mainContent: string; followUpQuestions: string[] } => {
    const followUpPattern = /---\s*\n\*\*Följdfrågor.*?\*\*\s*\n((?:•\s*.+\n?)+)/i;
    const match = content.match(followUpPattern);
    
    if (match) {
      const mainContent = content.replace(followUpPattern, '').trim();
      const questionsText = match[1];
      const questions = questionsText
        .split('\n')
        .map(q => q.replace(/^•\s*/, '').trim())
        .filter(q => q.length > 0);
      return { mainContent, followUpQuestions: questions };
    }
    
    return { mainContent: content, followUpQuestions: [] };
  };

  const { mainContent, followUpQuestions } = parseFollowUpQuestions(message.content);
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = (type: 'positive' | 'negative') => {
    const newFeedback = localFeedback === type ? null : type;
    setLocalFeedback(newFeedback);
    if (onFeedback && newFeedback) {
      onFeedback(message.id, newFeedback);
    }
  };

  const extractTitle = () => {
    const lines = message.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) return trimmed.slice(2);
      if (trimmed.startsWith('## ')) return trimmed.slice(3);
      if (trimmed.length > 5 && trimmed.length < 100) return trimmed;
    }
    return 'AIFM Rapport';
  };

  const parseTableData = () => {
    const lines = message.content.split('\n');
    const tables: Array<{ name: string; headers: string[]; data: string[][] }> = [];
    let currentTable: { name: string; headers: string[]; data: string[][] } | null = null;
    let lastHeading = 'Data';

    for (const line of lines) {
      if (line.startsWith('## ') || line.startsWith('### ')) {
        lastHeading = line.replace(/^#+\s*/, '').trim();
      }
      
      if (line.includes('|') && line.trim().startsWith('|')) {
        const cells = line.split('|').map(c => c.trim()).filter(c => c && !c.match(/^-+$/));
        
        if (cells.length > 0) {
          if (cells.every(c => c.match(/^-+$/))) continue;
          
          if (!currentTable) {
            currentTable = { name: lastHeading, headers: cells, data: [] };
          } else if (currentTable.headers.length === cells.length) {
            currentTable.data.push(cells);
          }
        }
      } else if (currentTable && currentTable.data.length > 0) {
        tables.push(currentTable);
        currentTable = null;
      }
    }
    
    if (currentTable && currentTable.data.length > 0) {
      tables.push(currentTable);
    }

    return tables;
  };

  const exportToPDF = async () => {
    setExporting('pdf');
    try {
      const title = extractTitle();
      const sections: Array<{ title: string; content: string }> = [];
      const lines = message.content.split('\n');
      let currentSection: { title: string; content: string } | null = null;
      
      for (const line of lines) {
        if (line.startsWith('## ') || line.startsWith('### ')) {
          if (currentSection) sections.push(currentSection);
          currentSection = { 
            title: line.replace(/^#+\s*/, '').trim(), 
            content: '' 
          };
        } else if (currentSection) {
          currentSection.content += line + '\n';
        }
      }
      if (currentSection) sections.push(currentSection);

      const response = await fetch('/api/ai/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: sections.length > 0 ? '' : message.content.replace(/[#*`]/g, ''),
          sections: sections.length > 0 ? sections.map(s => ({
            title: s.title,
            content: s.content.replace(/[#*`|]/g, '').trim(),
          })) : undefined,
          footer: `Genererat av AIFM Agent | ${new Date().toLocaleDateString('sv-SE')}`,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/[^a-zA-Z0-9åäöÅÄÖ\s]/g, '_')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('PDF export error:', error);
      showToast('Kunde inte exportera till PDF');
    }
    setExporting(null);
  };

  const exportToExcel = async () => {
    setExporting('excel');
    try {
      const title = extractTitle();
      const tables = parseTableData();
      
      const sheets = tables.length > 0 
        ? tables.map(t => ({
            name: t.name.slice(0, 31),
            headers: t.headers,
            data: t.data,
          }))
        : [{
            name: 'Sammanfattning',
            headers: ['Information'],
            data: message.content
              .split('\n')
              .filter(line => line.trim() && !line.startsWith('#'))
              .map(line => [line.replace(/[*`]/g, '').trim()]),
          }];

      const response = await fetch('/api/ai/generate-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, sheets }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/[^a-zA-Z0-9åäöÅÄÖ\s]/g, '_')}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Excel export error:', error);
      showToast('Kunde inte exportera till Excel');
    }
    setExporting(null);
  };
  
  if (message.role === 'user') {
    if (isEditing && onEditMessage && onCancelEdit) {
      return (
        <div className="flex flex-col items-end gap-2 animate-fade-in">
          <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl rounded-tr-md px-3 sm:px-4 py-2.5 sm:py-3 shadow-lg ${
            isDarkMode ? 'bg-[#c0a280] text-[#1a1918]' : 'bg-[#2d2a26] text-white'
          }`}>
            <textarea
              value={editDraft}
              onChange={e => setEditDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onEditMessage(message.id, editDraft);
                }
                if (e.key === 'Escape') onCancelEdit();
              }}
              className="w-full min-h-[60px] text-sm leading-relaxed bg-transparent border-none resize-none focus:outline-none focus:ring-0"
              rows={3}
              autoFocus
              aria-label="Redigera meddelande"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => onCancelEdit()}
                className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'hover:bg-black/20' : 'hover:bg-white/20'}`}
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={() => onEditMessage(message.id, editDraft)}
                disabled={!editDraft.trim()}
                className="text-xs px-2 py-1 rounded bg-white/20 disabled:opacity-50"
              >
                Skicka
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-end gap-0.5 animate-fade-in group/user">
        {/* Sender name for shared sessions */}
        {isSharedSession && message.senderName && (
          <span className={`text-[10px] font-medium mr-9 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {message.senderName}
          </span>
        )}
        <div className="flex justify-end gap-2 sm:gap-3">
          <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl rounded-tr-md px-3 sm:px-4 py-2.5 sm:py-3 shadow-lg relative ${
            isDarkMode ? 'bg-[#c0a280] text-[#1a1918]' : 'bg-[#2d2a26] text-white'
          }`}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap pr-8">{message.content}</p>
            {onStartEdit && (
              <button
                type="button"
                onClick={() => onStartEdit(message.id)}
                className={`absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover/user:opacity-100 transition-opacity ${
                  isDarkMode ? 'hover:bg-black/20' : 'hover:bg-white/20'
                }`}
                title="Redigera"
                aria-label="Redigera meddelande"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-[#c0a280] to-[#8a7355] flex items-center justify-center flex-shrink-0 shadow-md">
            <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
          </div>
        </div>
        {message.timestamp && (
          <span className={`text-[10px] mr-9 mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {new Date(message.timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    );
  }
  
  return (
    <div className="flex gap-2 sm:gap-3 animate-fade-in">
      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-md bg-gradient-to-br from-[#c0a280] to-[#8b7355]">
        <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
      </div>
      <div className="max-w-[85%] sm:max-w-[80%]">
        <div 
          className={`rounded-2xl rounded-tl-md px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm border transition-colors ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-100'
          }`}
          onClick={() => setShowActions(!showActions)}
        >
          <div className={`text-sm leading-relaxed ${
            isDarkMode ? 'text-gray-100' : 'text-[#2d2a26]'
          }`}>{formatMarkdown(mainContent)}</div>
          
          {/* Internal Knowledge Sources */}
          {message.internalSources && message.internalSources.length > 0 && (
            <div className={`mt-3 pt-2 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowSources(!showSources); }}
                className={`flex items-center gap-1.5 text-[10px] mb-1.5 ${
                  isDarkMode ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-700'
                }`}
              >
                <BookMarked className="w-3 h-3" />
                <span className="font-medium">Intern kunskapsbas ({message.internalSources.length} källor)</span>
                <ChevronRight className={`w-3 h-3 transition-transform ${showSources ? 'rotate-90' : ''}`} />
              </button>
              {showSources && (
                <div className="space-y-1.5 mt-2">
                  {message.internalSources.map((source) => (
                    <div 
                      key={source.id}
                      className={`p-2 rounded-lg text-xs border ${
                        isDarkMode 
                          ? 'bg-violet-900/30 border-violet-800/50' 
                          : 'bg-violet-50 border-violet-100'
                      }`}
                    >
                      <span className={`font-medium ${isDarkMode ? 'text-violet-300' : 'text-violet-800'}`}>{source.title || 'Okänd källa'}</span>
                      <div className={`flex items-center gap-2 mt-0.5 ${isDarkMode ? 'text-violet-400' : 'text-violet-600'}`}>
                        {source.category && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                            isDarkMode ? 'bg-violet-900/50' : 'bg-violet-100'
                          }`}>{source.category}</span>
                        )}
                        {source.sharedBy && (
                          <span className="text-[9px]">av {source.sharedBy.split('@')[0]}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* External Citations - Only show if they have valid titles */}
          {message.citations && message.citations.length > 0 && message.citations.some(c => c.documentTitle && c.documentTitle !== 'Okänt dokument' && !c.documentTitle.startsWith('Källa ')) && (
            <div className={`mt-3 pt-2 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <p className={`text-[10px] mb-1.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Externa källor</p>
              <div className="space-y-1.5">
                {message.citations
                  .filter(c => c.documentTitle && c.documentTitle !== 'Okänt dokument' && !c.documentTitle.startsWith('Källa '))
                  .slice(0, 3)
                  .map((citation, i) => (
                  <a 
                    key={i}
                    href={citation.sourceUrl !== '#' ? citation.sourceUrl : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block p-2 rounded-lg transition-colors text-xs ${
                      isDarkMode
                        ? `bg-gray-700 ${citation.sourceUrl !== '#' ? 'hover:bg-gray-600 cursor-pointer' : 'cursor-default'}`
                        : `bg-gray-50 ${citation.sourceUrl !== '#' ? 'hover:bg-[#c0a280]/5 cursor-pointer' : 'cursor-default'}`
                    }`}
                    onClick={citation.sourceUrl === '#' ? (e) => e.preventDefault() : undefined}
                  >
                    <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-[#2d2a26]'}`}>{citation.documentTitle}</span>
                    {citation.documentNumber && (
                      <span className={`ml-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>({citation.documentNumber})</span>
                    )}
                    {citation.section && (
                      <span className={`ml-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{citation.section}</span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}
          
          {/* Follow-up Questions */}
          {followUpQuestions.length > 0 && onFollowUp && (
            <div className={`mt-3 pt-2 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <p className={`text-[10px] mb-2 flex items-center gap-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <MessageSquare className="w-3 h-3" />
                Föreslagna följdfrågor
              </p>
              <div className="flex flex-wrap gap-1.5">
                {followUpQuestions.slice(0, 3).map((question, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); onFollowUp(question); }}
                    className={`px-2.5 py-1.5 text-[11px] border rounded-lg transition-colors text-left touch-manipulation ${
                      isDarkMode
                        ? 'text-gray-200 bg-gray-700 hover:bg-gray-600 border-gray-600 hover:border-[#c0a280]/40'
                        : 'text-[#2d2a26] bg-gray-50 hover:bg-[#c0a280]/10 border-gray-200 hover:border-[#c0a280]/30'
                    }`}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Compact Action Bar */}
          <div className={`mt-2 pt-2 border-t transition-all ${isDarkMode ? 'border-gray-700' : 'border-gray-50'} ${showActions ? 'block' : 'hidden sm:block'}`}>
            <div className="flex items-center gap-1">
              {/* Quick feedback buttons - always visible */}
              <div className={`flex items-center gap-0.5 rounded-lg p-0.5 ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
              }`}>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleFeedback('positive'); }}
                  className={`p-1.5 rounded-md transition-all duration-200 ${
                    localFeedback === 'positive' 
                      ? isDarkMode
                        ? 'text-green-400 bg-gray-600 shadow-sm scale-110'
                        : 'text-green-600 bg-white shadow-sm scale-110' 
                      : isDarkMode
                        ? 'text-gray-500 hover:text-green-400 hover:bg-gray-600'
                        : 'text-gray-400 hover:text-green-600 hover:bg-white'
                  }`}
                  title="Bra svar"
                aria-label="Bra svar"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleFeedback('negative'); }}
                  className={`p-1.5 rounded-md transition-all duration-200 ${
                    localFeedback === 'negative' 
                      ? isDarkMode
                        ? 'text-red-400 bg-gray-600 shadow-sm scale-110'
                        : 'text-red-600 bg-white shadow-sm scale-110' 
                      : isDarkMode
                        ? 'text-gray-500 hover:text-red-400 hover:bg-gray-600'
                        : 'text-gray-400 hover:text-red-600 hover:bg-white'
                  }`}
                  title="Dåligt svar"
                aria-label="Dåligt svar"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Copy button - quick access */}
              <button 
                onClick={(e) => { e.stopPropagation(); copyToClipboard(); }}
                className={`p-1.5 rounded-lg transition-all duration-200 ${
                  copied 
                    ? isDarkMode
                      ? 'text-green-400 bg-green-900/30'
                      : 'text-green-600 bg-green-50' 
                    : isDarkMode
                      ? 'text-gray-500 hover:text-[#c0a280] hover:bg-gray-700'
                      : 'text-gray-400 hover:text-[#c0a280] hover:bg-gray-50'
                }`}
                title={copied ? 'Kopierat!' : 'Kopiera'}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {/* Quote / Citera - use this reply in next message */}
              {onQuote && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onQuote(message); }}
                  className={`p-1.5 rounded-lg transition-all duration-200 ${
                    isDarkMode
                      ? 'text-gray-500 hover:text-[#c0a280] hover:bg-gray-700'
                      : 'text-gray-400 hover:text-[#c0a280] hover:bg-gray-50'
                  }`}
                  title="Citera detta svar i nästa meddelande"
                aria-label="Citera svar"
                >
                  <Quote className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Start branch - fork conversation from this message */}
              {onStartBranch && showBranchAction && message.role === 'assistant' && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onStartBranch(message.id); }}
                  className={`p-1.5 rounded-lg transition-all duration-200 ${
                    isDarkMode
                      ? 'text-gray-500 hover:text-[#c0a280] hover:bg-gray-700'
                      : 'text-gray-400 hover:text-[#c0a280] hover:bg-gray-50'
                  }`}
                  title="Starta gren – fortsätt från detta svar i en ny tråd"
                aria-label="Starta gren"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Text-to-speech button */}
              <button 
                onClick={(e) => { e.stopPropagation(); toggleSpeak(); }}
                className={`p-1.5 rounded-lg transition-all duration-200 ${
                  isSpeaking 
                    ? isDarkMode
                      ? 'text-[#c0a280] bg-[#c0a280]/20 animate-pulse'
                      : 'text-[#c0a280] bg-[#c0a280]/10 animate-pulse' 
                    : isDarkMode
                      ? 'text-gray-500 hover:text-[#c0a280] hover:bg-gray-700'
                      : 'text-gray-400 hover:text-[#c0a280] hover:bg-gray-50'
                }`}
                title={isSpeaking ? 'Stoppa uppläsning' : 'Läs upp'}
              >
                {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              {/* Share to knowledge base - prominent button */}
              {onShare && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onShare(message); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 border ${
                    isDarkMode
                      ? 'text-[#d4b896] border-[#c0a280]/30 hover:bg-[#c0a280]/15 hover:border-[#c0a280]/50'
                      : 'text-[#8a7355] border-[#c0a280]/30 hover:bg-[#c0a280]/10 hover:border-[#c0a280]/50'
                  }`}
                  title="Dela till kunskapsbasen – gör tillgänglig för hela teamet"
                aria-label="Dela till kunskapsbasen"
                >
                  <BookMarked className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Kunskapsbas</span>
                </button>
              )}

              {/* Actions dropdown menu */}
              <ActionDropdown
                onRegenerate={isLastAssistantMessage && onRegenerate ? () => onRegenerate(message.id) : undefined}
                onReformulate={onReformulate ? (type: 'simplify' | 'expand' | 'formal') => onReformulate(message.id, type) : undefined}
                onExportPDF={exportToPDF}
                onExportExcel={exportToExcel}
                isExporting={exporting}
                isDarkMode={isDarkMode}
              />
            </div>
          </div>
          {message.timestamp && (
            <span className={`text-[10px] mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {new Date(message.timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// Loading Animation
// ============================================================================

interface LoadingIndicatorProps {
  characterCount?: number;
  startTime?: number | null;
  isDarkMode?: boolean;
}

function LoadingIndicator({ characterCount = 0, startTime = null, isDarkMode = false }: LoadingIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime) return;
    const tick = () => setElapsed(Math.floor((Date.now() - startTime!) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  const estimatedTokens = Math.round(characterCount / 4);
  return (
    <div className="flex gap-2 sm:gap-3 animate-fade-in">
      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-md bg-gradient-to-br from-[#c0a280] to-[#8b7355]">
        <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
      </div>
      <div className={`border rounded-2xl rounded-tl-md px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
      }`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-[#c0a280] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-[#c0a280] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-[#c0a280] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Tänker...</span>
          </div>
          {(characterCount > 0 || (startTime != null && elapsed > 0)) && (
            <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {characterCount > 0 && <>{estimatedTokens} ord</>}
              {characterCount > 0 && startTime != null && elapsed > 0 && ' · '}
              {startTime != null && elapsed > 0 && `${elapsed}s`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// File Icon Helper
// ============================================================================

function getFileIcon(type: string) {
  if (type.includes('pdf')) return <FileText className="w-4 h-4" />;
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return <FileSpreadsheet className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
}

// ============================================================================
// Mobile History Drawer
// ============================================================================

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  isLoading: boolean;
  onLoadSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewChat: () => void;
  onTogglePin?: (sessionId: string) => void;
  isDarkMode?: boolean;
  hasMoreSessions?: boolean;
  onLoadMoreSessions?: () => void;
  isLoadingSessions?: boolean;
  pendingInvitations?: ChatInvitation[];
  onAcceptInvitation?: (invitation: ChatInvitation) => void;
  onDismissInvitation?: (invitation: ChatInvitation) => void;
}

function HistoryDrawer({ 
  isOpen, 
  onClose, 
  sessions, 
  currentSessionId, 
  isLoading,
  onLoadSession, 
  onDeleteSession, 
  onNewChat,
  onTogglePin,
  isDarkMode = false,
  hasMoreSessions = false,
  onLoadMoreSessions,
  isLoadingSessions = false,
  pendingInvitations = [],
  onAcceptInvitation,
  onDismissInvitation,
}: HistoryDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just nu';
    if (minutes < 60) return `${minutes} min`;
    if (hours < 24) return `${hours} tim`;
    if (days < 7) return `${days} d`;
    return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
  };

  // Filter sessions based on search query
  const filteredSessions = searchQuery.trim() 
    ? sessions.filter(session => {
        const query = searchQuery.toLowerCase();
        // Search in title
        if (session.title?.toLowerCase().includes(query)) return true;
        // Search in messages content
        if (session.messages?.some(msg => msg.content?.toLowerCase().includes(query))) return true;
        return false;
      })
    : sessions;

  // Sort: pinned first, then by updatedAt
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    if (bp !== ap) return bp - ap;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 lg:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className={`fixed top-0 left-0 bottom-0 w-[85%] max-w-sm z-50 transform transition-transform duration-300 ease-out lg:hidden shadow-2xl ${
          isDarkMode ? 'bg-gray-900' : 'bg-white'
        } ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <h2 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-[#2d2a26]'}`}>Chatthistorik</h2>
            <button
              onClick={onClose}
              className={`p-2 -mr-2 rounded-lg touch-manipulation ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Search Input */}
          <div className="px-3 pt-3">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sök i chatthistorik..."
                className={`w-full pl-10 pr-8 py-2.5 text-sm border rounded-xl focus:ring-2 focus:ring-[#c0a280]/50 focus:border-[#c0a280] transition-colors ${
                  isDarkMode ? 'border-gray-600 bg-gray-800 text-gray-100 placeholder-gray-500' : 'border-gray-200 bg-white text-[#2d2a26] placeholder-gray-400'
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          {/* New Chat Button */}
          <div className={`p-3 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
            <button
              onClick={() => { onNewChat(); onClose(); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#2d2a26] text-white 
                       rounded-xl font-medium text-sm shadow-lg touch-manipulation active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" />
              Ny chatt
            </button>
          </div>
          
          {/* Shared With Me - Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <div className={`p-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                <Users className={`w-3.5 h-3.5 ${isDarkMode ? 'text-violet-400' : 'text-violet-500'}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-violet-400' : 'text-violet-600'}`}>
                  Delade med dig
                </span>
                <span className="text-[10px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5">
                  {pendingInvitations.length}
                </span>
              </div>
              <div className="space-y-1">
                {pendingInvitations.map((inv) => (
                  <div
                    key={inv.invitationId}
                    className={`p-3 rounded-xl border ${
                      isDarkMode
                        ? 'bg-violet-900/20 border-violet-800/40'
                        : 'bg-violet-50 border-violet-100'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-violet-500 flex-shrink-0 mt-0.5">
                        {(inv.senderName || inv.senderEmail || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-200' : 'text-[#2d2a26]'}`}>
                          {inv.senderName || inv.senderEmail}
                        </p>
                        <p className={`text-[11px] mt-0.5 truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {inv.sessionTitle}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <button
                            onClick={() => { onAcceptInvitation?.(inv); onClose(); }}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-[#2d2a26] rounded-lg hover:bg-[#3d3a36] transition-colors touch-manipulation active:scale-95"
                          >
                            Gå med
                          </button>
                          <button
                            onClick={() => onDismissInvitation?.(inv)}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors touch-manipulation ${
                              isDarkMode
                                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            Avvisa
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className={`w-6 h-6 animate-spin ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
              </div>
            ) : sortedSessions.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageSquare className={`w-10 h-10 mx-auto mb-3 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                {searchQuery ? (
                  <>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Inga resultat för "{searchQuery}"</p>
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Prova ett annat sökord</p>
                  </>
                ) : (
                  <>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Inga tidigare chattar</p>
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Dina konversationer sparas här</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {searchQuery && (
                  <p className={`text-xs px-2 py-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    {sortedSessions.length} träff{sortedSessions.length !== 1 ? 'ar' : ''}
                  </p>
                )}
                {sortedSessions.map((session) => (
                  <button
                    key={session.sessionId}
                    onClick={() => { onLoadSession(session.sessionId); onClose(); }}
                    className={`w-full text-left p-3 rounded-xl transition-all group relative touch-manipulation border ${
                      currentSessionId === session.sessionId
                        ? 'bg-[#c0a280]/15 border-[#c0a280]/30'
                        : isDarkMode
                          ? 'hover:bg-gray-800 active:bg-gray-700 border-transparent'
                          : 'hover:bg-gray-50 active:bg-gray-100 border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#c0a280]/20 text-[#8b7355]">
                        {session.pinned ? <Pin className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0 pr-16">
                        <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-gray-100' : 'text-[#2d2a26]'}`}>
                          {session.title}
                        </p>
                        <p className={`text-xs flex items-center gap-1 mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(session.updatedAt)}
                        </p>
                      </div>
                    </div>
                    
                    {onTogglePin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onTogglePin(session.sessionId); }}
                        className={`absolute right-12 top-1/2 -translate-y-1/2 p-2 rounded-lg touch-manipulation ${
                          session.pinned ? 'text-[#8b7355] bg-[#c0a280]/15' : isDarkMode ? 'text-gray-500 hover:text-[#8b7355] hover:bg-[#c0a280]/10' : 'text-gray-300 hover:text-[#8b7355] hover:bg-[#c0a280]/10'
                        }`}
                        title={session.pinned ? 'Avfäst' : 'Fäst överst'}
                      >
                        {session.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteSession(session.sessionId); }}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg touch-manipulation ${
                        isDarkMode ? 'text-gray-500 hover:text-red-400 hover:bg-red-900/30' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                      }`}
                      title="Ta bort"
                      aria-label="Ta bort chatt"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </button>
                ))}
              </div>
            )}
            
            {hasMoreSessions && onLoadMoreSessions && (
              <button
                type="button"
                onClick={onLoadMoreSessions}
                disabled={isLoadingSessions}
                className="w-full mt-2 py-2.5 text-sm rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 bg-[#c0a280]/10 text-[#8b7355] hover:bg-[#c0a280]/20 touch-manipulation"
              >
                {isLoadingSessions ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Ladda fler
              </button>
            )}
          </div>
          
          {/* Footer */}
          <div className={`p-4 border-t ${isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
            <p className={`text-xs text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Chattar sparas säkert i ditt konto
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Main Component - Mobile-First Fullscreen Chat
// ============================================================================

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AgentMode>('claude');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  // Chat history state
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [hasMoreSessions, setHasMoreSessions] = useState(false);
  const [sessionsStartKey, setSessionsStartKey] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [addingTagSessionId, setAddingTagSessionId] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [messageSearchIndex, setMessageSearchIndex] = useState(0);
  const [showInputPreview, setShowInputPreview] = useState(false);
  const [quotedMessage, setQuotedMessage] = useState<Message | null>(null);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId | null>(null);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  const [sessionBranches, setSessionBranches] = useState<ChatBranch[]>([]);
  const [mainThreadMessages, setMainThreadMessages] = useState<Message[]>([]);
  
  // Mobile drawer state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  // Shared session state
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [sharedOwnerUserId, setSharedOwnerUserId] = useState<string | null>(null);
  const [sharedParticipants, setSharedParticipants] = useState<{ userId: string; name: string; email: string; role: string }[]>([]);
  const [isSharedSession, setIsSharedSession] = useState(false);
  const sharedPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUpdatedAtRef = useRef<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Knowledge sharing state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [messageToShare, setMessageToShare] = useState<Message | null>(null);
  
  // Share-with-colleague panel state
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [colleagues, setColleagues] = useState<{ username: string; name: string; email: string }[]>([]);
  const [colleagueSearch, setColleagueSearch] = useState('');
  const [loadingColleagues, setLoadingColleagues] = useState(false);
  const sharePanelRef = useRef<HTMLDivElement>(null);
  
  // Invitation notification state
  const [pendingInvitations, setPendingInvitations] = useState<ChatInvitation[]>([]);
  const [showInvitationPanel, setShowInvitationPanel] = useState(false);
  const invitationPanelRef = useRef<HTMLDivElement>(null);
  
  // Delete session confirmation
  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(null);
  const deleteDialogRef = useFocusTrap(!!sessionToDeleteId);
  const summaryDialogRef = useFocusTrap(summaryModalOpen);
  const isStandalone = useIsStandalone();
  const isMobile = useIsMobile();
  const showBottomNav = isStandalone && isMobile;
  
  // Voice input via hook
  const voiceInput = useVoiceInput({
    language: 'sv-SE',
    continuous: true,
    onResult: (transcript) => setInput(prev => prev + transcript + ' '),
    onError: (errorMsg) => showToast(errorMsg),
  });
  const { isListening, isSupported: voiceSupported, toggleListening: toggleVoiceInput } = voiceInput;
  
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);
  const isUserScrollingRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const streamingStartTimeRef = useRef<number | null>(null);

  // Stable handler refs – keep latest handler in ref, expose stable wrapper
  const handleRegenerateRef = useRef<(messageId: string) => void>(() => {});
  const handleEditMessageRef = useRef<(messageId: string, newContent: string) => void>(() => {});
  const handleReformulateRef = useRef<(messageId: string, type: 'simplify' | 'expand' | 'formal') => void>(() => {});
  const stableHandleRegenerate = useCallback((id: string) => handleRegenerateRef.current(id), []);
  const stableHandleEditMessage = useCallback((id: string, c: string) => handleEditMessageRef.current(id, c), []);
  const stableHandleReformulate = useCallback((id: string, t: 'simplify' | 'expand' | 'formal') => handleReformulateRef.current(id, t), []);

  // Load chat sessions on mount and auto-open the latest session
  useEffect(() => {
    const sharedSessionId = searchParams.get('session');
    const shareParam = searchParams.get('share');
    
    if (shareParam) {
      // Join a shared session via share code
      joinSharedSession(shareParam);
      loadChatSessions(false);
    } else if (sharedSessionId) {
      // If there's a session in the URL, load that specific one
      loadSession(sharedSessionId);
      loadChatSessions(false);
    } else {
      // Otherwise, load sessions and auto-open the most recent one
      loadChatSessions(true);
    }
    
    // Cleanup polling on unmount
    return () => {
      if (sharedPollRef.current) {
        clearInterval(sharedPollRef.current);
      }
    };
  }, []);

  // Initialize dark mode from localStorage, falling back to system preference
  const prefersSystemDark = usePrefersDarkMode();
  useEffect(() => {
    const saved = localStorage.getItem('aifm-dark-mode');
    const shouldBeDark = saved !== null ? saved === 'true' : prefersSystemDark;
    if (shouldBeDark) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, [prefersSystemDark]);

  // Get current user name from cookie for shared sessions
  useEffect(() => {
    try {
      const cookies = document.cookie.split(';').map(c => c.trim());
      const tokenCookie = cookies.find(c => c.startsWith('__Host-aifm_id_token='));
      if (tokenCookie) {
        const token = tokenCookie.split('=').slice(1).join('=');
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          setCurrentUserName(payload.name || payload.email?.split('@')[0] || '');
        }
      }
    } catch {
      // Not critical
    }
  }, []);

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('aifm-chat-draft');
    if (savedDraft) {
      setInput(savedDraft);
    }
  }, []);

  // Save draft to localStorage when input changes
  useEffect(() => {
    if (input.trim()) {
      localStorage.setItem('aifm-chat-draft', input);
    } else {
      localStorage.removeItem('aifm-chat-draft');
    }
  }, [input]);

  // Clear draft when message is sent
  const clearDraft = useCallback(() => {
    localStorage.removeItem('aifm-chat-draft');
  }, []);

  // Voice recognition is now handled by the useVoiceInput hook above

  // Share panel: close on click outside or Escape; fetch colleagues when opened
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sharePanelRef.current && !sharePanelRef.current.contains(e.target as Node)) {
        setShowSharePanel(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSharePanel(false);
    };
    if (showSharePanel) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showSharePanel]);

  useEffect(() => {
    if (!showSharePanel) return;
    if (colleagues.length > 0) return;
    setLoadingColleagues(true);
    fetch('/api/chat/colleagues')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load'))))
      .then((data) => setColleagues(data.colleagues || []))
      .catch(() => setColleagues([]))
      .finally(() => setLoadingColleagues(false));
  }, [showSharePanel, colleagues.length]);

  // Fetch pending invitations on mount and poll every 30s
  const fetchInvitations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/invitations');
      if (res.ok) {
        const data = await res.json();
        setPendingInvitations(data.invitations || []);
      }
    } catch {
      // Silently ignore - invitations are non-critical
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
    const interval = setInterval(fetchInvitations, 30000);
    return () => clearInterval(interval);
  }, [fetchInvitations]);

  // Close invitation panel on outside click
  useEffect(() => {
    if (!showInvitationPanel) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (invitationPanelRef.current && !invitationPanelRef.current.contains(e.target as Node)) {
        setShowInvitationPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showInvitationPanel]);

  // Accept an invitation – join the shared session and mark it accepted
  const acceptInvitation = async (invitation: ChatInvitation) => {
    setShowInvitationPanel(false);
    // Mark as accepted
    fetch('/api/chat/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', invitationId: invitation.invitationId }),
    }).catch(() => {});
    // Remove from local list immediately
    setPendingInvitations(prev => prev.filter(i => i.invitationId !== invitation.invitationId));
    // Join the shared session
    await joinSharedSession(invitation.shareCode);
    showToast(`Gick med i "${invitation.sessionTitle}"`);
  };

  // Dismiss an invitation
  const dismissInvitation = async (invitation: ChatInvitation) => {
    fetch('/api/chat/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss', invitationId: invitation.invitationId }),
    }).catch(() => {});
    setPendingInvitations(prev => prev.filter(i => i.invitationId !== invitation.invitationId));
  };

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => {
      const newValue = !prev;
      localStorage.setItem('aifm-dark-mode', String(newValue));
      if (newValue) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return newValue;
    });
  }, []);

  // Keyboard shortcuts (desktop only)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Close message search first
      if (e.key === 'Escape' && showMessageSearch) {
        e.preventDefault();
        setShowMessageSearch(false);
        setMessageSearchQuery('');
        return;
      }
      // Cmd/Ctrl+F: Toggle in-conversation search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowMessageSearch((prev) => !prev);
        if (!showMessageSearch) setMessageSearchIndex(0);
        return;
      }
      // Cmd/Ctrl+K: New chat
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setMessages([]);
        setCurrentSessionId(null);
        setInput('');
        setAttachedFiles([]);
        clearDraft();
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      // Cmd/Ctrl+Enter: Send message (handled by form)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
      }
      // Escape: Clear input (only when input is focused)
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        e.preventDefault();
        setInput('');
        clearDraft();
      }
      // Cmd/Ctrl+D: Toggle dark mode
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        toggleDarkMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearDraft, toggleDarkMode, showMessageSearch]);

  // When virtual keyboard opens (visualViewport shrinks), keep input in view on mobile
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    let lastHeight = vv.height;

    const handleViewportResize = () => {
      const newHeight = vv.height;
      if (newHeight < lastHeight && inputRef.current) {
        inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
      lastHeight = newHeight;
    };

    vv.addEventListener('resize', handleViewportResize);
    return () => vv.removeEventListener('resize', handleViewportResize);
  }, []);

  // Track user scrolling
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      if (scrollTop < lastScrollTopRef.current && !isNearBottom) {
        isUserScrollingRef.current = true;
      }
      
      if (isNearBottom) {
        isUserScrollingRef.current = false;
      }
      
      lastScrollTopRef.current = scrollTop;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const loadChatSessions = async (autoLoadLatest = false) => {
    setIsLoadingSessions(true);
    try {
      const response = await fetch('/api/chat/sessions?limit=20');
      if (response.ok) {
        const data = await response.json();
        const sessions = data.sessions || [];
        setChatSessions(sessions);
        setHasMoreSessions(!!data.hasMore);
        setSessionsStartKey(data.lastEvaluatedKey ?? null);
        if (autoLoadLatest && sessions.length > 0 && !currentSessionId && messages.length === 0) {
          const latestSession = sessions[0];
          loadSession(latestSession.sessionId);
        }
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
      showToast('Kunde inte ladda chattar');
    }
    setIsLoadingSessions(false);
  };

  const loadMoreSessions = async () => {
    if (!sessionsStartKey || isLoadingSessions) return;
    setIsLoadingSessions(true);
    try {
      const response = await fetch(`/api/chat/sessions?limit=20&startKey=${sessionsStartKey}`);
      if (response.ok) {
        const data = await response.json();
        const nextSessions = data.sessions || [];
        setChatSessions(prev => [...prev, ...nextSessions]);
        setHasMoreSessions(!!data.hasMore);
        setSessionsStartKey(data.lastEvaluatedKey ?? null);
      }
    } catch (error) {
      console.error('Failed to load more sessions:', error);
      showToast('Kunde inte ladda fler chattar');
    }
    setIsLoadingSessions(false);
  };

  const saveSession = async (newMessages?: Message[], branches?: ChatBranch[]) => {
    // Allow creating new session when currentSessionId is null (first message)
    if (newMessages && newMessages.length === 0 && !branches) return;
    if (!currentSessionId && !(newMessages && newMessages.length > 0)) return;
    
    try {
      const body: Record<string, unknown> = {
        // Omit sessionId when creating new session (first message)
        ...(currentSessionId ? { sessionId: currentSessionId } : {}),
        // For shared sessions, write to the owner's session
        ...(isSharedSession && sharedOwnerUserId && shareCode ? {
          ownerUserId: sharedOwnerUserId,
          shareCode,
        } : {}),
      };
      if (newMessages && newMessages.length > 0) {
        const title = newMessages[0]?.content?.slice(0, 50) + (newMessages[0]?.content?.length > 50 ? '...' : '');
        body.title = title;
        body.mode = mode;
        body.messages = newMessages;
      }
      if (Array.isArray(branches)) body.branches = branches;
      
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        const session = await response.json();
        if (!isSharedSession) {
          setCurrentSessionId(session.sessionId);
        }
        lastUpdatedAtRef.current = new Date().toISOString();
        
        setChatSessions(prev => {
          const filtered = prev.filter(s => s.sessionId !== session.sessionId);
          return [session, ...filtered];
        });
      }
    } catch (error) {
      console.error('Failed to save session:', error);
      showToast('Kunde inte spara chatt');
    }
  };

  /** Start a branch (fork) at the given message; user continues from there on the new branch */
  const startBranch = useCallback((messageId: string) => {
    const i = messages.findIndex(m => m.id === messageId);
    if (i < 0) return;
    setMainThreadMessages(messages);
    const branch: ChatBranch = {
      branchId: crypto.randomUUID(),
      parentMessageId: messageId,
      messages: messages.slice(0, i + 1),
      createdAt: new Date().toISOString(),
    };
    setSessionBranches(prev => {
      const next = [...prev, branch];
      saveSession(undefined, next);
      return next;
    });
    setCurrentBranchId(branch.branchId);
    setMessages(branch.messages);
  }, [messages, currentSessionId, isSharedSession, sharedOwnerUserId, shareCode]);

  /** Persist messages to main thread or current branch */
  const persistMessages = useCallback((finalMessages: Message[]) => {
    if (currentBranchId) {
      setSessionBranches(prev => {
        const next = prev.map(b => b.branchId === currentBranchId ? { ...b, messages: finalMessages } : b);
        saveSession(undefined, next);
        return next;
      });
    } else {
      setMainThreadMessages(finalMessages);
      saveSession(finalMessages);
    }
  }, [currentBranchId, currentSessionId, isSharedSession, sharedOwnerUserId, shareCode, mode]);

  const loadSession = async (sessionId: string) => {
    try {
      // Stop any existing polling
      if (sharedPollRef.current) {
        clearInterval(sharedPollRef.current);
        sharedPollRef.current = null;
      }

      const response = await fetch(`/api/chat/sessions?sessionId=${sessionId}`);
      if (response.ok) {
        const session = await response.json();
        const mainMsgs = session.messages || [];
        setMessages(mainMsgs);
        setMainThreadMessages(mainMsgs);
        setSessionBranches(session.branches || []);
        setCurrentBranchId(null);
        setMode(session.mode || 'claude');
        setCurrentSessionId(sessionId);

        // Check if this session is shared
        try {
          const shareResponse = await fetch(`/api/chat/sessions/share?sessionId=${sessionId}`);
          if (shareResponse.ok) {
            const shareData = await shareResponse.json();
            if (shareData.isShared) {
              setShareCode(shareData.shareCode);
              setSharedParticipants(shareData.participants || []);
              setIsSharedSession(true);
              lastUpdatedAtRef.current = new Date().toISOString();
              startSharedPolling(shareData.shareCode);
            } else {
              setShareCode(null);
              setSharedParticipants([]);
              setIsSharedSession(false);
              setSharedOwnerUserId(null);
            }
          }
        } catch {
          // Share check failed, not critical
        }
      }
    } catch (error) {
      console.error('Failed to load session:', error);
      showToast('Kunde inte ladda chatten');
    }
  };

  // Join a shared session
  const joinSharedSession = async (code: string) => {
    try {
      const response = await fetch('/api/chat/sessions/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', shareCode: code }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setMainThreadMessages(data.messages || []);
        setSessionBranches([]);
        setCurrentBranchId(null);
        setMode(data.mode || 'claude');
        setCurrentSessionId(data.sessionId);
        setShareCode(code);
        setSharedOwnerUserId(data.ownerUserId);
        setSharedParticipants(data.participants || []);
        setIsSharedSession(true);
        lastUpdatedAtRef.current = new Date().toISOString();

        // Start polling for updates
        startSharedPolling(code);
      } else {
        const errData = await response.json().catch(() => ({}));
        showToast(errData.error || 'Delningslänken är ogiltig eller har löpt ut.');
      }
    } catch (error) {
      console.error('Failed to join shared session:', error);
      showToast('Kunde inte gå med i delad session.');
    }
  };

  // Poll for updates on shared sessions (pauses when tab is hidden)
  const startSharedPolling = (code: string) => {
    if (sharedPollRef.current) {
      clearInterval(sharedPollRef.current);
    }

    sharedPollRef.current = setInterval(async () => {
      try {
        const since = lastUpdatedAtRef.current || '';
        const response = await fetch(`/api/chat/sessions/share?shareCode=${code}&since=${encodeURIComponent(since)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.hasUpdates && data.messages) {
            setMessages(data.messages);
            setSharedParticipants(data.participants || []);
            lastUpdatedAtRef.current = data.updatedAt || new Date().toISOString();
            // Browser notification when tab is in background
            if (typeof Notification !== 'undefined' && document.hidden) {
              if (Notification.permission === 'granted') {
                try {
                  new Notification('Delad chatt – ny aktivitet', {
                    body: 'Någon har skrivit i konversationen.',
                  });
                } catch {
                  // ignore
                }
              } else if (Notification.permission === 'default') {
                Notification.requestPermission();
              }
            }
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        showToast('Kunde inte uppdatera delad chatt');
      }
    }, 5000);
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setCurrentBranchId(null);
    setSessionBranches([]);
    setMainThreadMessages([]);
    setInput('');
    setAttachedFiles([]);
    setShareCode(null);
    setSharedOwnerUserId(null);
    setSharedParticipants([]);
    setIsSharedSession(false);
    if (sharedPollRef.current) {
      clearInterval(sharedPollRef.current);
      sharedPollRef.current = null;
    }
    // Focus the input after a short delay to ensure state is updated
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await fetch(`/api/chat/sessions?sessionId=${sessionId}`, { method: 'DELETE' });
      setChatSessions(prev => prev.filter(s => s.sessionId !== sessionId));
      if (currentSessionId === sessionId) {
        startNewChat();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      showToast('Kunde inte ta bort chatten');
    }
  };

  const confirmDeleteSession = (sessionId: string) => {
    setSessionToDeleteId(sessionId);
  };

  const handleRegenerate = async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    
    const userMessageIndex = messageIndex - 1;
    if (userMessageIndex < 0 || messages[userMessageIndex].role !== 'user') return;
    
    const userMessage = messages[userMessageIndex];
    const messagesWithoutResponse = messages.slice(0, messageIndex);
    setMessages(messagesWithoutResponse);
    
    isUserScrollingRef.current = false;
    setIsLoading(true);
    
    const newAssistantMessageId = `assistant-${Date.now()}`;
    const newAssistantMessage: Message = {
      id: newAssistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      mode,
    };
    
    setMessages(prev => [...prev, newAssistantMessage]);
    
    try {
      const endpoint = '/api/ai/chat';
      const useStreaming = true;
      
      let originalContent = userMessage.content;
      if (originalContent.includes('📎 Bifogade filer:')) {
        originalContent = originalContent.split('📎 Bifogade filer:')[0].trim();
      }
      
      let messageWithContext = originalContent;
      if (userMessage.attachments && userMessage.attachments.length > 0) {
        const fileContexts = userMessage.attachments.map(f => 
          `--- Innehåll från ${f.name} ---\n${f.content}\n--- Slut på ${f.name} ---`
        ).join('\n\n');
        
        messageWithContext = messageWithContext 
          ? `${messageWithContext}\n\nHär är innehållet från de bifogade filerna:\n\n${fileContexts}`
          : `Analysera följande dokument:\n\n${fileContexts}`;
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: messageWithContext,
          message: messageWithContext,
          history: messagesWithoutResponse.slice(-10).map(m => ({ role: m.role, content: m.content })),
          mode,
          stream: useStreaming,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to get response');
      
      if (useStreaming && response.headers.get('content-type')?.includes('text/event-stream')) {
        const { fullContent } = await streamAssistantResponse(response, ({ fullContent: content }) => {
          setMessages(prev => prev.map(m => m.id === newAssistantMessageId ? { ...m, content } : m));
        });
        const finalMessages = [...messagesWithoutResponse, { ...newAssistantMessage, content: fullContent }];
        setMessages(finalMessages);
        persistMessages(finalMessages);
      } else {
        const data = await response.json();
        const finalContent = data.answer || data.response || data.content || 'Inget svar mottogs.';
        const finalMessages = [...messagesWithoutResponse, { 
          ...newAssistantMessage, 
          content: finalContent,
          citations: data.citations,
          confidence: data.confidence,
        }];
        setMessages(finalMessages);
        persistMessages(finalMessages);
      }
    } catch (error) {
      console.error('Regenerate error:', error);
      setMessages(prev => prev.map(m => 
        m.id === newAssistantMessageId 
          ? { ...m, content: 'Kunde inte generera nytt svar. Försök igen.' }
          : m
      ));
      showToast('Kunde inte generera nytt svar. Försök igen.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1 || messages[messageIndex].role !== 'user') return;
    const trimmed = newContent.trim();
    if (!trimmed) return;

    setEditingMessageId(null);
    const messagesUpToEdited = messages.slice(0, messageIndex + 1).map((m, i) =>
      i === messageIndex ? { ...m, content: trimmed } : m
    );
    setMessages(messagesUpToEdited);
    isUserScrollingRef.current = false;
    setIsLoading(true);

    const newAssistantMessageId = `assistant-${Date.now()}`;
    const newAssistantMessage: Message = {
      id: newAssistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      mode,
    };
    setMessages(prev => [...prev, newAssistantMessage]);

    try {
      const messageWithContext = trimmed.includes('📎 Bifogade filer:')
        ? trimmed.split('📎 Bifogade filer:')[0].trim()
        : trimmed;
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: messageWithContext,
          message: messageWithContext,
          history: messagesUpToEdited.slice(-10).map(m => ({ role: m.role, content: m.content })),
          mode,
          stream: true,
        }),
      });
      if (!response.ok) throw new Error('Failed to get response');

      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        const { fullContent } = await streamAssistantResponse(response, ({ fullContent: content }) => {
          setMessages(prev => prev.map(m => (m.id === newAssistantMessageId ? { ...m, content } : m)));
        });
        const finalMessages = [...messagesUpToEdited, { ...newAssistantMessage, content: fullContent }];
        setMessages(finalMessages);
        persistMessages(finalMessages);
      } else {
        const data = await response.json();
        const finalContent = data.answer || data.response || data.content || 'Inget svar mottogs.';
        const finalMessages = [...messagesUpToEdited, { ...newAssistantMessage, content: finalContent, citations: data.citations, confidence: data.confidence }];
        setMessages(finalMessages);
        persistMessages(finalMessages);
      }
    } catch (error) {
      console.error('Edit message error:', error);
      setMessages(prev => prev.map(m => (m.id === newAssistantMessageId ? { ...m, content: 'Kunde inte skicka. Försök igen.' } : m)));
      showToast('Kunde inte skicka redigerat meddelande.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = useCallback(async (messageId: string, feedback: 'positive' | 'negative') => {
    setMessages(prev => {
      const updatedMessages = prev.map(m => 
        m.id === messageId ? { ...m, feedback } : m
      );
      persistMessages(updatedMessages);
      return updatedMessages;
    });
    
    try {
      await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          sessionId: currentSessionId,
          feedback,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to save feedback:', error);
      showToast('Kunde inte spara feedback');
    }
  }, [currentSessionId, persistMessages]);

  // Handle follow-up question - just set the input and optionally auto-send
  const handleFollowUp = useCallback((question: string) => {
    setInput(question);
    inputRef.current?.focus();
  }, []);

  const handleOpenShareModal = useCallback((msg: Message) => {
    setMessageToShare(msg);
    setShareModalOpen(true);
  }, []);

  const handleCancelEdit = useCallback(() => setEditingMessageId(null), []);

  // Handle reformulate request
  const handleReformulate = async (messageId: string, type: 'simplify' | 'expand' | 'formal') => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const reformulatePrompts = {
      simplify: 'Förenkla och sammanfatta detta svar så att det blir lättare att förstå. Använd enklare språk och kortare meningar:',
      expand: 'Utveckla och ge mer detaljer om detta svar. Lägg till exempel och förklaringar:',
      formal: 'Omformulera detta svar till ett mer formellt och professionellt språk, lämpligt för ett affärsdokument:',
    };

    const prompt = `${reformulatePrompts[type]}\n\n${message.content}`;
    
    isUserScrollingRef.current = false;
    setIsLoading(true);

    const newAssistantMessageId = `assistant-${Date.now()}`;
    const newAssistantMessage: Message = {
      id: newAssistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      mode,
    };

    setMessages(prev => [...prev, newAssistantMessage]);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          mode,
          stream: true,
          skipKnowledgeBase: true, // No need to search KB for reformulation
        }),
      });

      if (response.body && response.headers.get('content-type')?.includes('text/event-stream')) {
        const { fullContent } = await streamAssistantResponse(response, ({ fullContent: content }) => {
          setMessages(prev => prev.map(m => m.id === newAssistantMessageId ? { ...m, content } : m));
        });
        if (fullContent) {
          const finalMessages = [...messages, { ...newAssistantMessage, content: fullContent }];
          setMessages(finalMessages);
          persistMessages(finalMessages);
        }
      }
    } catch (error) {
      console.error('Reformulate error:', error);
      setMessages(prev => prev.map(m =>
        m.id === newAssistantMessageId
          ? { ...m, content: 'Kunde inte omformulera svaret. Försök igen.' }
          : m
      ));
      showToast('Kunde inte omformulera svaret. Försök igen.');
    } finally {
      setIsLoading(false);
    }
  };

  // Keep stable refs pointing at latest handler versions
  handleRegenerateRef.current = handleRegenerate;
  handleEditMessageRef.current = handleEditMessage;
  handleReformulateRef.current = handleReformulate;

  const filteredSessions = chatSessions.filter(session => {
    if (!historySearch.trim()) return true;
    const searchLower = historySearch.toLowerCase();
    return session.title.toLowerCase().includes(searchLower) ||
           session.messages?.some(m => m.content.toLowerCase().includes(searchLower));
  });

  // Sort: pinned first, then by updatedAt
  const sortedFilteredSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (bp !== ap) return bp - ap;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [filteredSessions]);

  const filteredColleagues = useMemo(() => {
    if (!colleagueSearch.trim()) return colleagues;
    const q = colleagueSearch.toLowerCase().trim();
    return colleagues.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [colleagues, colleagueSearch]);

  const messageSearchMatches = useMemo(() => {
    if (!messageSearchQuery.trim()) return [];
    const q = messageSearchQuery.toLowerCase().trim();
    return messages
      .map((m, i) => (m.content && m.content.toLowerCase().includes(q) ? i : -1))
      .filter((i) => i >= 0);
  }, [messages, messageSearchQuery]);

  const currentMessageSearchMatch = messageSearchMatches.length > 0
    ? messageSearchMatches[Math.min(messageSearchIndex, messageSearchMatches.length - 1)]
    : null;

  useEffect(() => {
    if (currentMessageSearchMatch == null || !chatContainerRef.current) return;
    const el = chatContainerRef.current.querySelector(`[data-message-index="${currentMessageSearchMatch}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentMessageSearchMatch, messageSearchIndex]);

  const togglePin = async (sessionId: string) => {
    const session = chatSessions.find(s => s.sessionId === sessionId);
    if (!session) return;
    const newPinned = !session.pinned;
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, pinned: newPinned }),
      });
      if (response.ok) {
        setChatSessions(prev => prev.map(s =>
          s.sessionId === sessionId ? { ...s, pinned: newPinned, pinnedAt: newPinned ? new Date().toISOString() : undefined } : s
        ));
      }
    } catch (e) {
      console.error('Failed to toggle pin:', e);
      showToast('Kunde inte uppdatera pin');
    }
  };

  const updateSessionTags = async (sessionId: string, tags: string[]) => {
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, tags }),
      });
      if (response.ok) {
        setChatSessions(prev => prev.map(s =>
          s.sessionId === sessionId ? { ...s, tags } : s
        ));
      }
    } catch (e) {
      console.error('Failed to update tags:', e);
      showToast('Kunde inte uppdatera taggar');
    }
  };

  const renameSession = async (sessionId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, title: trimmed }),
      });
      if (response.ok) {
        setChatSessions(prev => prev.map(s =>
          s.sessionId === sessionId ? { ...s, title: trimmed } : s
        ));
        setEditingSessionId(null);
        setEditingSessionTitle('');
      } else {
        showToast('Kunde inte byta namn');
      }
    } catch (e) {
      console.error('Failed to rename session:', e);
      showToast('Kunde inte byta namn');
    }
  };

  const suggestTags = async (sessionId: string) => {
    const session = chatSessions.find(s => s.sessionId === sessionId);
    if (!session?.messages?.length) return;
    try {
      const response = await fetch('/api/chat/sessions/suggest-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: session.messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      if (response.ok) {
        const { tags: suggested } = await response.json();
        const existing = new Set(session.tags || []);
        const merged = [...(session.tags || []), ...(suggested || []).filter((t: string) => !existing.has(t))];
        const unique = [...new Set(merged)].slice(0, 10);
        await updateSessionTags(sessionId, unique);
        showToast('Taggar föreslagna');
      }
    } catch (e) {
      console.error('Failed to suggest tags:', e);
      showToast('Kunde inte föreslå taggar');
    }
  };

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setInput(textarea.value);
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFile(true);
    
    for (const file of Array.from(files)) {
      if (!isFileTypeSupported(file)) {
        showToast(`Filtypen ${file.type || file.name.split('.').pop()} stöds inte.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        showToast('Filen är för stor. Max 10MB.');
        continue;
      }
      try {
        const attachment = await processFileAttachment(file);
        setAttachedFiles(prev => [...prev, attachment]);
      } catch (error) {
        console.error('[File] Processing error:', error);
        showToast(error instanceof Error ? error.message : `Kunde inte bearbeta filen: ${file.name}`);
      }
    }

    setIsProcessingFile(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    setIsProcessingFile(true);
    
    for (const file of Array.from(files)) {
      if (!isFileTypeSupported(file)) {
        showToast(`Filtypen ${file.type || file.name.split('.').pop()} stöds inte.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        showToast('Filen är för stor. Max 10MB.');
        continue;
      }
      try {
        const attachment = await processFileAttachment(file);
        setAttachedFiles(prev => [...prev, attachment]);
      } catch (error) {
        console.error('[File/Drop] Processing error:', error);
        showToast(error instanceof Error ? error.message : `Kunde inte bearbeta filen: ${file.name}`);
      }
    }

    setIsProcessingFile(false);
  }, []);

  // Handle paste from clipboard (images and files)
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // First, check for files copied from file explorer
    const files = clipboardData.files;
    if (files && files.length > 0) {
      e.preventDefault();
      setIsProcessingFile(true);

      for (const file of Array.from(files)) {
        if (!isFileTypeSupported(file)) {
          showToast(`Filtypen ${file.type || file.name.split('.').pop()} stöds inte.`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          showToast('Filen är för stor. Max 10MB.');
          continue;
        }
        try {
          const attachment = await processFileAttachment(file);
          setAttachedFiles(prev => [...prev, attachment]);
        } catch (error) {
          console.error('Paste file error:', error);
          showToast(`Kunde inte klistra in filen: ${file.name}`);
        }
      }

      setIsProcessingFile(false);
      return;
    }

    // Then check for images in clipboard items (screenshots, copied images)
    const items = clipboardData.items;
    if (!items) return;

    const imageItems: DataTransferItem[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        imageItems.push(item);
      }
    }

    // If no images found, let default paste behavior handle it (text)
    if (imageItems.length === 0) return;

    e.preventDefault();
    setIsProcessingFile(true);

    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;

      if (file.size > MAX_FILE_SIZE) {
        showToast('Bilden är för stor. Max 10MB.');
        continue;
      }

      try {
        // Generate a filename for the pasted image
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = file.type.split('/')[1] || 'png';
        const fileName = `screenshot-${timestamp}.${extension}`;
        const namedFile = new File([file], fileName, { type: file.type });

        const attachment = await processFileAttachment(namedFile);
        setAttachedFiles(prev => [...prev, attachment]);
      } catch (error) {
        console.error('Paste image error:', error);
        showToast('Kunde inte klistra in bilden');
      }
    }

    setIsProcessingFile(false);
  }, []);

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;
    
    isUserScrollingRef.current = false;
    
    let displayContent = input.trim();
    const quotePrefix = quotedMessage
      ? `Citerar från tidigare svar:\n\n${quotedMessage.content}\n\n---\n\n`
      : '';
    if (quotePrefix) displayContent = quotePrefix + displayContent;
    if (attachedFiles.length > 0) {
      const fileNames = attachedFiles.map(f => f.name).join(', ');
      displayContent = displayContent 
        ? `${displayContent}\n\n📎 Bifogade filer: ${fileNames}`
        : `📎 Bifogade filer: ${fileNames}`;
    }
    
    setQuotedMessage(null);
    const templateIdForRequest = messages.length === 0 ? selectedTemplateId : undefined;
    if (templateIdForRequest) setSelectedTemplateId(null);
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: displayContent,
      timestamp: new Date().toISOString(),
      mode,
      attachments: attachedFiles.length > 0 ? [...attachedFiles] : undefined,
      ...(isSharedSession && currentUserName ? { senderName: currentUserName } : {}),
    };
    
    // Separate image files from document files for proper handling
    const imageFiles = attachedFiles.filter(f => f.type.startsWith('image/'));
    const documentFiles = attachedFiles.filter(f => !f.type.startsWith('image/'));
    
    let messageWithContext = input.trim();
    if (quotedMessage) {
      messageWithContext = `Citerar från tidigare svar:\n\n${quotedMessage.content}\n\n---\n\n${messageWithContext}`;
    }
    
    // Add document content as text context
    if (documentFiles.length > 0) {
      const fileContexts = documentFiles.map(f => 
        `--- Innehåll från ${f.name} ---\n${f.content}\n--- Slut på ${f.name} ---`
      ).join('\n\n');
      
      messageWithContext = messageWithContext 
        ? `${messageWithContext}\n\nHär är innehållet från de bifogade filerna:\n\n${fileContexts}`
        : `Analysera följande dokument:\n\n${fileContexts}`;
    }
    
    // Prepare image attachments with base64 data for vision API
    const imageAttachments = imageFiles
      .filter(f => f.preview) // Only include images with base64 preview
      .map(f => ({
        name: f.name,
        type: f.type,
        // Extract base64 data from data URL (remove "data:image/png;base64," prefix)
        data: f.preview!.split(',')[1],
        mediaType: f.type as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
      }));
    
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    clearDraft();
    setAttachedFiles([]);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    setIsLoading(true);
    streamingStartTimeRef.current = Date.now();
    
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      mode,
    };
    
    setMessages(prev => [...prev, assistantMessage]);
    
    try {
      const endpoint = '/api/ai/chat';
      const useStreaming = true;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: messageWithContext,
          message: messageWithContext,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          mode,
          hasAttachments: attachedFiles.length > 0,
          images: imageAttachments, // Send image data for vision API
          stream: useStreaming,
          ...(templateIdForRequest ? { templateId: templateIdForRequest } : {}),
        }),
      });
      
      if (!response.ok) throw new Error('Failed to get response');
      
      if (useStreaming && response.headers.get('content-type')?.includes('text/event-stream')) {
        const { fullContent, citations: streamCitations, internalSources: streamInternalSources } = await streamAssistantResponse(response, ({ fullContent: content, citations: c, internalSources: s }) => {
          setMessages(prev => prev.map(m => 
            m.id === assistantMessageId ? { ...m, content, citations: c, internalSources: s } : m
          ));
        });
        const finalMessages = [...updatedMessages, { 
          ...assistantMessage, 
          content: fullContent, 
          citations: streamCitations,
          internalSources: streamInternalSources,
        }];
        setMessages(finalMessages);
        persistMessages(finalMessages);
      } else {
        const data = await response.json();
        
        const finalContent = data.answer || data.response || data.content || 'Inget svar mottogs.';
        
        setMessages(prev => prev.map(m => 
          m.id === assistantMessageId 
            ? { 
                ...m, 
                content: finalContent,
                citations: data.citations,
                confidence: data.confidence,
              }
            : m
        ));
        
        const finalMessages = [...updatedMessages, { 
          ...assistantMessage, 
          content: finalContent,
          citations: data.citations,
          confidence: data.confidence,
        }];
        persistMessages(finalMessages);
      }
      
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.map(m => 
        m.id === assistantMessageId 
          ? { ...m, content: 'Kunde inte svara just nu. Försök igen.' }
          : m
      ));
      showToast('Kunde inte svara just nu. Försök igen.');
    } finally {
      setIsLoading(false);
      streamingStartTimeRef.current = null;
    }
  };

  const handleExampleClick = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  // Export entire conversation as PDF
  const exportConversationAsPDF = async () => {
    if (messages.length === 0) return;
    
    try {
      const title = chatSessions.find(s => s.sessionId === currentSessionId)?.title || 'AIFM Konversation';
      
      // Format messages for PDF
      const sections = messages.map((msg, i) => ({
        title: msg.role === 'user' ? `Fråga ${Math.ceil((i + 1) / 2)}` : `Svar ${Math.ceil((i + 1) / 2)}`,
        content: msg.content,
      }));
      
      const response = await fetch('/api/ai/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title,
          subtitle: `Exporterad ${new Date().toLocaleDateString('sv-SE')} kl ${new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`,
          content: '',
          sections,
          footer: 'AIFM Agent | Exporterad konversation',
        }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/[^a-zA-Z0-9åäöÅÄÖ\s]/g, '_')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export error:', error);
      showToast('Kunde inte exportera konversationen');
    }
  };

  // Export entire conversation as Word (.docx)
  const exportConversationAsWord = async () => {
    if (messages.length === 0) return;
    try {
      const title = chatSessions.find(s => s.sessionId === currentSessionId)?.title || 'AIFM Konversation';
      const sections = messages.map((msg, i) => ({
        title: msg.role === 'user' ? `Fråga ${Math.ceil((i + 1) / 2)}` : `Svar ${Math.ceil((i + 1) / 2)}`,
        content: msg.content,
      }));
      const response = await fetch('/api/ai/generate-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          subtitle: `Exporterad ${new Date().toLocaleDateString('sv-SE')} kl ${new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`,
          content: '',
          sections,
          footer: 'AIFM Agent | Exporterad konversation',
        }),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/[^a-zA-Z0-9åäöÅÄÖ\s]/g, '_')}.docx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Word export error:', error);
      showToast('Kunde inte exportera konversationen till Word');
    }
  };

  // Summarize conversation (3–5 points)
  const summarizeConversation = async () => {
    if (messages.length === 0) return;
    setSummaryLoading(true);
    setSummaryModalOpen(true);
    setSummaryText('');
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        setSummaryText(data.summary);
      } else {
        setSummaryText('Kunde inte generera sammanfattning.');
      }
    } catch {
      setSummaryText('Kunde inte generera sammanfattning.');
    } finally {
      setSummaryLoading(false);
    }
  };

  // Toast notification helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Share conversation - create collaborative share link (optionally with selected colleague name for toast)
  const shareConversation = async (colleague?: { name: string; email: string }) => {
    if (!currentSessionId) {
      showToast('Skicka ett meddelande först för att kunna dela');
      return;
    }
    
    try {
      const response = await fetch('/api/chat/sessions/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          sessionId: currentSessionId,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const shareUrl = `${window.location.origin}/chat?share=${data.shareCode}`;
        
        setShareCode(data.shareCode);
        setSharedParticipants(data.participants || []);
        setIsSharedSession(true);
        setShowSharePanel(false);

        // Start polling for this newly shared session
        startSharedPolling(data.shareCode);

        // Send invitation to the selected colleague so they see a notification
        if (colleague?.email) {
          const sessionTitle = chatSessions.find(s => s.sessionId === currentSessionId)?.title || 'Delad chatt';
          fetch('/api/chat/invitations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              recipientEmail: colleague.email,
              recipientName: colleague.name || colleague.email,
              shareCode: data.shareCode,
              sessionTitle,
            }),
          }).catch(() => { /* ignore invitation errors – share link still works */ });
        }

        await navigator.clipboard.writeText(shareUrl);
        const displayName = colleague?.name || colleague?.email;
        showToast(displayName ? `Delad med ${displayName}! Länk kopierad.` : 'Delningslänk kopierad! Skicka till en kollega.');
      } else {
        const msg = data.error || (response.status === 401 ? 'Logga in för att dela' : response.status === 404 ? 'Konversationen hittades inte – vänta några sekunder och försök igen' : `Kunde inte dela (${response.status})`);
        showToast(msg);
      }
    } catch (e) {
      console.error('Share error:', e);
      showToast('Kunde inte skapa delningslänk');
    }
  };

  // Stop sharing a conversation
  const stopSharing = async () => {
    if (!shareCode) return;
    
    try {
      const response = await fetch('/api/chat/sessions/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', shareCode }),
      });

      if (response.ok) {
        setShareCode(null);
        setSharedParticipants([]);
        setIsSharedSession(false);
        setSharedOwnerUserId(null);
        if (sharedPollRef.current) {
          clearInterval(sharedPollRef.current);
          sharedPollRef.current = null;
        }
        showToast('Delningen avslutad');
      }
    } catch {
      showToast('Kunde inte avsluta delningen');
    }
  };

  // Request response in different language
  const requestInLanguage = async (language: 'english' | 'swedish') => {
    if (messages.length === 0) return;
    
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistantMessage) return;
    
    const prompt = language === 'english' 
      ? `Please translate the following response to English. Keep the same formatting and structure:\n\n${lastAssistantMessage.content}`
      : `Vänligen översätt följande svar till svenska. Behåll samma formatering och struktur:\n\n${lastAssistantMessage.content}`;
    
    setIsLoading(true);
    
    const newAssistantMessageId = `assistant-${Date.now()}`;
    const newAssistantMessage: Message = {
      id: newAssistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      mode,
    };
    
    setMessages(prev => [...prev, newAssistantMessage]);
    
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          history: [],
          mode,
          stream: true,
          skipKnowledgeBase: true,
        }),
      });
      
      if (!response.ok) throw new Error('Translation failed');

      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        const { fullContent } = await streamAssistantResponse(response, ({ fullContent: content }) => {
          setMessages(prev => prev.map(m => m.id === newAssistantMessageId ? { ...m, content } : m));
        });
        if (fullContent) {
          const finalMessages = [...messages, { ...newAssistantMessage, content: fullContent }];
          setMessages(finalMessages);
          persistMessages(finalMessages);
        } else {
          setMessages(prev => prev.filter(m => m.id !== newAssistantMessageId));
          showToast('Kunde inte översätta svaret.');
        }
      }
    } catch (error) {
      console.error('Translation error:', error);
      setMessages(prev => prev.filter(m => m.id !== newAssistantMessageId));
      showToast('Kunde inte översätta svaret. Försök igen.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just nu';
    if (minutes < 60) return `${minutes} min sedan`;
    if (hours < 24) return `${hours} tim sedan`;
    if (days < 7) return `${days} dagar sedan`;
    return date.toLocaleDateString('sv-SE');
  };

  const displayedSessions = showAllSessions ? sortedFilteredSessions : sortedFilteredSessions.slice(0, 5);

  return (
    <div 
      className={`h-[100dvh] flex flex-col transition-colors duration-200 ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      } ${showBottomNav ? 'pb-16' : ''}`}
      style={{ 
        paddingTop: 'env(safe-area-inset-top)', 
        paddingBottom: showBottomNav ? undefined : 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-2 duration-300">
          <div className={`px-4 py-2.5 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 ${
            isDarkMode
              ? 'bg-gray-800 border-gray-700 text-gray-100'
              : 'bg-white border-gray-200 text-gray-800'
          }`}>
            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
            {toastMessage}
          </div>
        </div>
      )}

      {/* Knowledge Sharing Modal */}
      <ShareToKnowledgeBase
        isOpen={shareModalOpen}
        onClose={() => {
          setShareModalOpen(false);
          setMessageToShare(null);
        }}
        messageContent={messageToShare?.content || ''}
        messageId={messageToShare?.id}
        sessionId={currentSessionId || undefined}
        onSuccess={() => {
          // Could show a toast notification here
        }}
        isDarkMode={isDarkMode}
      />

      {/* Delete session confirmation */}
      {sessionToDeleteId && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setSessionToDeleteId(null)}
            aria-hidden
          />
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Bekräfta borttagning"
            className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-sm rounded-xl shadow-xl p-5 ${
              isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}
          >
            <p className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              Ta bort denna chatt? Det går inte att ångra.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setSessionToDeleteId(null)}
                className={`px-3 py-2 text-sm rounded-lg ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteSession(sessionToDeleteId);
                  setSessionToDeleteId(null);
                }}
                className="px-3 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Ta bort
              </button>
            </div>
          </div>
        </>
      )}

      {/* Summary Modal */}
      {summaryModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setSummaryModalOpen(false)}
            aria-hidden
          />
          <div
            ref={summaryDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="summary-dialog-title"
            className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-lg rounded-2xl shadow-xl max-h-[80vh] flex flex-col ${
              isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 id="summary-dialog-title" className={`font-semibold ${isDarkMode ? 'text-white' : 'text-[#2d2a26]'}`}>
                Sammanfattning av konversationen
              </h2>
              <button
                onClick={() => setSummaryModalOpen(false)}
                className={`p-2 rounded-lg ${isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}
                aria-label="Stäng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className={`flex-1 overflow-y-auto p-4 text-sm leading-relaxed whitespace-pre-wrap ${
              isDarkMode ? 'text-gray-200' : 'text-[#2d2a26]'
            }`}>
              {summaryLoading ? (
                <div className="flex items-center justify-center gap-2 py-8">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Genererar sammanfattning...</span>
                </div>
              ) : (
                summaryText || 'Ingen sammanfattning tillgänglig.'
              )}
            </div>
          </div>
        </>
      )}

      {/* Mobile History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={chatSessions}
        currentSessionId={currentSessionId}
        isLoading={isLoadingSessions}
        onLoadSession={loadSession}
        onDeleteSession={confirmDeleteSession}
        onNewChat={startNewChat}
        onTogglePin={togglePin}
        isDarkMode={isDarkMode}
        hasMoreSessions={hasMoreSessions}
        onLoadMoreSessions={loadMoreSessions}
        isLoadingSessions={isLoadingSessions}
        pendingInvitations={pendingInvitations}
        onAcceptInvitation={acceptInvitation}
        onDismissInvitation={dismissInvitation}
      />

      {/* Compact Mobile Header */}
      <header className={`flex-shrink-0 border-b transition-colors duration-200 ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3">
          {/* Left: Menu + Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className={`lg:hidden p-2 -ml-2 rounded-lg touch-manipulation transition-colors ${
                isDarkMode 
                  ? 'text-gray-300 hover:text-white hover:bg-gray-700' 
                  : 'text-gray-600 hover:text-[#2d2a26] hover:bg-gray-100'
              }`}
            >
              <Menu className="w-5 h-5" />
            </button>
            <Image
              src="/AIFM_logo.png"
              alt="AIFM"
              width={80}
              height={26}
              className={`h-6 sm:h-8 w-auto ${isDarkMode ? 'brightness-0 invert' : ''}`}
              priority
            />
          </div>
          
          {/* Right: New Chat + Dashboard */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startNewChat();
              }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium 
                         border rounded-lg transition-all touch-manipulation active:scale-95 ${
                isDarkMode
                  ? 'text-[#d4b896] hover:text-[#e8d4bc] hover:bg-[#c0a280]/20 border-[#c0a280]/40'
                  : 'text-[#c0a280] hover:text-[#8a7355] hover:bg-[#c0a280]/10 border-[#c0a280]/30'
              }`}
              title="Starta ny chatt"
              aria-label="Starta ny chatt"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Ny chatt</span>
            </button>
            
            {/* Summarize conversation */}
            {messages.length > 0 && messages.some(m => m.role === 'assistant') && (
              <button
                onClick={summarizeConversation}
                disabled={summaryLoading}
                className={`p-2 rounded-lg transition-colors touch-manipulation disabled:opacity-50 ${
                  isDarkMode
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                    : 'text-gray-500 hover:text-[#2d2a26] hover:bg-gray-100'
                }`}
                title="Sammanfatta konversationen"
                aria-label="Sammanfatta konversationen"
              >
                {summaryLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ListChecks className="w-4 h-4" />
                )}
              </button>
            )}
            {/* Export conversation as PDF */}
            {messages.length > 0 && (
              <button
                onClick={exportConversationAsPDF}
                className={`p-2 rounded-lg transition-colors touch-manipulation ${
                  isDarkMode
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                    : 'text-gray-500 hover:text-[#2d2a26] hover:bg-gray-100'
                }`}
                title="Exportera som PDF"
                aria-label="Exportera som PDF"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            {/* Export conversation as Word */}
            {messages.length > 0 && (
              <button
                onClick={exportConversationAsWord}
                className={`p-2 rounded-lg transition-colors touch-manipulation ${
                  isDarkMode
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                    : 'text-gray-500 hover:text-[#2d2a26] hover:bg-gray-100'
                }`}
                title="Exportera som Word"
                aria-label="Exportera som Word"
              >
                <FileText className="w-4 h-4" />
              </button>
            )}
            
            {/* Invitation notification bell */}
            <div className="relative" ref={invitationPanelRef}>
              <button
                onClick={() => setShowInvitationPanel(prev => !prev)}
                className={`relative p-2 rounded-lg transition-colors touch-manipulation ${
                  showInvitationPanel
                    ? 'text-[#c0a280] bg-[#c0a280]/10'
                    : isDarkMode
                      ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                      : 'text-gray-500 hover:text-[#2d2a26] hover:bg-gray-100'
                }`}
                title="Inbjudningar"
                aria-label={`Inbjudningar${pendingInvitations.length > 0 ? ` (${pendingInvitations.length} nya)` : ''}`}
              >
                <Bell className="w-4 h-4" />
                {pendingInvitations.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-800 animate-in zoom-in duration-200">
                    {pendingInvitations.length}
                  </span>
                )}
              </button>

              {/* Invitation dropdown */}
              {showInvitationPanel && (
                <div
                  className={`absolute right-0 top-full mt-2 w-[320px] max-h-[400px] rounded-xl shadow-xl border flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${
                    isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className={`px-4 py-3 border-b flex items-center justify-between ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                    <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-gray-100' : 'text-[#2d2a26]'}`}>
                      Inbjudningar
                    </h3>
                    {pendingInvitations.length > 0 && (
                      <span className="text-[10px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5">
                        {pendingInvitations.length}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto min-h-0">
                    {pendingInvitations.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 px-4">
                        <Bell className={`w-8 h-8 mb-2 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Inga nya inbjudningar
                        </p>
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          När någon delar en chatt med dig visas det här
                        </p>
                      </div>
                    ) : (
                      <div className="py-1">
                        {pendingInvitations.map((inv) => (
                          <div
                            key={inv.invitationId}
                            className={`px-4 py-3 border-b last:border-0 ${isDarkMode ? 'border-gray-700' : 'border-gray-50'}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-violet-500 flex-shrink-0">
                                {(inv.senderName || inv.senderEmail || '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-100' : 'text-[#2d2a26]'}`}>
                                  {inv.senderName || inv.senderEmail}
                                </p>
                                <p className={`text-xs mt-0.5 truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                  bjöd in dig till &quot;{inv.sessionTitle}&quot;
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    onClick={() => acceptInvitation(inv)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#2d2a26] rounded-lg hover:bg-[#3d3a36] transition-colors touch-manipulation active:scale-95"
                                  >
                                    <Users className="w-3 h-3" />
                                    Gå med
                                  </button>
                                  <button
                                    onClick={() => dismissInvitation(inv)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors touch-manipulation ${
                                      isDarkMode
                                        ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                    }`}
                                  >
                                    Avvisa
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Share conversation */}
            {currentSessionId && (
              <div className="relative flex items-center gap-1" ref={sharePanelRef}>
                <button
                  onClick={() => setShowSharePanel((prev) => !prev)}
                  className={`p-2 rounded-lg transition-colors touch-manipulation ${
                    showSharePanel
                      ? 'text-[#c0a280] bg-[#c0a280]/10'
                      : isSharedSession
                        ? isDarkMode
                          ? 'text-green-400 hover:text-green-300 hover:bg-green-900/30'
                          : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                        : isDarkMode
                          ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                          : 'text-gray-500 hover:text-[#2d2a26] hover:bg-gray-100'
                  }`}
                  title={isSharedSession ? 'Delad – klicka för att kopiera länk igen' : 'Dela konversation med kollega'}
                >
                  {isSharedSession ? <Users className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                </button>
                {/* Participant avatars */}
                {isSharedSession && sharedParticipants.length > 1 && (
                  <div className="flex -space-x-1.5" title={sharedParticipants.map(p => p.name || p.email).join(', ')}>
                    {sharedParticipants.slice(0, 4).map((p, i) => (
                      <div
                        key={p.userId}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                          isDarkMode ? 'border-gray-800' : 'border-white'
                        } ${
                          i === 0 
                            ? 'bg-violet-500 text-white' 
                            : i === 1 
                              ? 'bg-blue-500 text-white'
                              : i === 2
                                ? 'bg-emerald-500 text-white'
                                : 'bg-amber-500 text-white'
                        }`}
                        title={p.name || p.email}
                      >
                        {(p.name || p.email || '?').charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {sharedParticipants.length > 4 && (
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                        isDarkMode ? 'border-gray-800 bg-gray-600 text-gray-200' : 'border-white bg-gray-200 text-gray-600'
                      }`}>
                        +{sharedParticipants.length - 4}
                      </div>
                    )}
                  </div>
                )}
                {/* Share colleague picker dropdown */}
                {showSharePanel && (
                  <div
                    className={`absolute right-0 top-full mt-2 w-[280px] max-h-[320px] rounded-xl shadow-xl border flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${
                      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className={`p-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                      <div className={`relative flex items-center rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <Search className={`absolute left-2.5 w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                        <input
                          type="text"
                          value={colleagueSearch}
                          onChange={(e) => setColleagueSearch(e.target.value)}
                          placeholder="Sök kollega..."
                          className={`w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-transparent focus:outline-none ${
                            isDarkMode ? 'text-gray-100 placeholder-gray-500' : 'text-[#2d2a26] placeholder-gray-400'
                          }`}
                        />
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto min-h-0 py-1">
                      {loadingColleagues ? (
                        <div className={`flex items-center justify-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      ) : filteredColleagues.length === 0 ? (
                        <p className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {colleagueSearch.trim() ? 'Inga kollegor matchar sökningen' : 'Inga kollegor att visa'}
                        </p>
                      ) : (
                        filteredColleagues.map((c, i) => {
                          const initial = (c.name || c.email || '?').charAt(0).toUpperCase();
                          const colors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500'];
                          const bg = colors[i % colors.length];
                          return (
                            <button
                              key={c.username}
                              type="button"
                              onClick={() => shareConversation({ name: c.name, email: c.email })}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                isDarkMode
                                  ? 'text-gray-200 hover:bg-gray-700'
                                  : 'text-[#2d2a26] hover:bg-gray-50'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 ${bg}`}>
                                {initial}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className={`font-medium truncate ${isDarkMode ? 'text-gray-100' : 'text-[#2d2a26]'}`}>
                                  {c.name || c.email || 'Okänd'}
                                </div>
                                {c.email && c.name && (
                                  <div className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {c.email}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                    <div className={`p-2 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                      <button
                        type="button"
                        onClick={() => shareConversation()}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                          isDarkMode
                            ? 'text-gray-300 hover:bg-gray-700'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Link2 className="w-4 h-4" />
                        Kopiera länk
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Language toggle */}
            {messages.length > 0 && messages.some(m => m.role === 'assistant') && (
              <button
                onClick={() => requestInLanguage('english')}
                className={`p-2 rounded-lg transition-colors touch-manipulation ${
                  isDarkMode
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                    : 'text-gray-500 hover:text-[#2d2a26] hover:bg-gray-100'
                }`}
                title="Översätt till engelska"
                aria-label="Översätt till engelska"
              >
                <Globe className="w-4 h-4" />
              </button>
            )}
            
            <button
              onClick={() => router.push('/knowledge')}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium 
                         rounded-lg transition-colors touch-manipulation ${
                isDarkMode
                  ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                  : 'text-gray-600 hover:text-[#2d2a26] hover:bg-gray-100'
              }`}
              title="Kunskapsbas"
              aria-label="Kunskapsbas"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden xs:inline">Kunskap</span>
            </button>
            <button
              onClick={() => router.push('/overview')}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium 
                         rounded-lg transition-colors touch-manipulation ${
                isDarkMode
                  ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                  : 'text-gray-600 hover:text-[#2d2a26] hover:bg-gray-100'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden xs:inline">Dashboard</span>
            </button>
            <button
              onClick={() => router.push('/admin/stats')}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium 
                         rounded-lg transition-colors touch-manipulation ${
                isDarkMode
                  ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                  : 'text-gray-600 hover:text-[#2d2a26] hover:bg-gray-100'
              }`}
              title="Statistik"
              aria-label="Statistik"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Stats</span>
            </button>
            <button
              onClick={toggleDarkMode}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium 
                         rounded-lg transition-colors touch-manipulation ${
                isDarkMode
                  ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                  : 'text-gray-600 hover:text-[#2d2a26] hover:bg-gray-100'
              }`}
              title={isDarkMode ? 'Ljust läge (⌘D)' : 'Mörkt läge (⌘D)'}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Drag & Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-[#c0a280]/10 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-[#c0a280] rounded-xl m-2 transition-all duration-200">
          <div className="text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-[#c0a280]/20 flex items-center justify-center">
              <Paperclip className="w-6 h-6 sm:w-8 sm:h-8 text-[#c0a280]" />
            </div>
            <p className="text-base sm:text-lg font-medium text-[#2d2a26]">Släpp filer här</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">PDF, Word, Excel, bilder</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Security Banner - Collapsible on mobile */}
          <div className={`flex-shrink-0 border-b px-3 sm:px-4 py-1.5 sm:py-2 transition-colors duration-200 ${
            isDarkMode 
              ? 'bg-emerald-900/30 border-emerald-800/50' 
              : 'bg-emerald-50 border-emerald-100'
          }`}>
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              <Shield className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${
                isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
              }`} />
              <span className={`text-[10px] sm:text-xs font-medium truncate ${
                isDarkMode ? 'text-emerald-300' : 'text-emerald-700'
              }`}>
                Säker miljö – Data stannar inom AWS/EU
              </span>
            </div>
          </div>

          {/* Shared session banner */}
          {isSharedSession && (
            <div className={`flex-shrink-0 px-3 py-2 flex items-center justify-between text-xs border-b ${
              isDarkMode 
                ? 'bg-violet-900/20 border-violet-800/40 text-violet-300' 
                : 'bg-violet-50 border-violet-100 text-violet-700'
            }`}>
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-medium">
                  Delad konversation
                </span>
                <span className="opacity-60 hidden sm:inline">•</span>
                <span className="opacity-75 hidden sm:inline truncate max-w-[200px]">
                  {sharedParticipants.map(p => p.name || p.email?.split('@')[0] || '?').join(', ')}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={async () => {
                    if (shareCode) {
                      const url = `${window.location.origin}/chat?share=${shareCode}`;
                      await navigator.clipboard.writeText(url);
                      showToast('Länk kopierad!');
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    isDarkMode
                      ? 'hover:bg-violet-800/40 text-violet-300'
                      : 'hover:bg-violet-100 text-violet-600'
                  }`}
                  title="Kopiera delningslänk"
                  aria-label="Kopiera delningslänk"
                >
                  Kopiera länk
                </button>
                <button
                  onClick={stopSharing}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    isDarkMode
                      ? 'hover:bg-red-900/30 text-red-400'
                      : 'hover:bg-red-50 text-red-500'
                  }`}
                  title="Sluta dela konversationen"
                  aria-label="Sluta dela"
                >
                  Sluta dela
                </button>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto px-3 sm:px-4"
            aria-live="polite"
            aria-relevant="additions"
          >
            <div className="max-w-3xl mx-auto py-3 sm:py-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center pt-8 sm:pt-16 pb-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 shadow-lg bg-gradient-to-br from-[#c0a280] to-[#8b7355]">
                    <Bot className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                  
                  <h1 className={`text-lg sm:text-2xl font-semibold mb-1.5 sm:mb-2 text-center transition-colors ${
                    isDarkMode ? 'text-white' : 'text-[#2d2a26]'
                  }`}>
                    Hej! Hur kan jag hjälpa?
                  </h1>
                  <p className={`text-xs sm:text-sm mb-4 text-center max-w-md px-4 transition-colors ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Claude 4.6 – all data stannar inom AWS
                  </p>
                  
                  <div className="w-full max-w-lg mb-6 sm:mb-8">
                    <TemplateSelector
                      isDarkMode={isDarkMode}
                      onSelect={(template) => {
                        setSelectedTemplateId(template.id);
                        setInput(template.initialMessage);
                      }}
                    />
                  </div>
                  
                  <p className={`text-[10px] sm:text-xs mb-2 text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    eller välj en exempelfråga
                  </p>
                  <div className="w-full max-w-lg space-y-2 px-2">
                    {EXAMPLE_QUESTIONS.map((question, i) => (
                      <button
                        key={i}
                        onClick={() => handleExampleClick(question)}
                        className={`w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 border rounded-xl
                                   text-xs sm:text-sm transition-all duration-200 shadow-sm touch-manipulation ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 text-gray-300 hover:border-[#c0a280] hover:bg-gray-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-[#c0a280] hover:bg-[#c0a280]/5'
                        }`}
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {showMessageSearch && (
                    <div className={`sticky top-0 z-10 flex items-center gap-2 p-2 rounded-xl border mb-2 ${
                      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    }`}>
                      <Search className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                      <input
                        type="text"
                        value={messageSearchQuery}
                        onChange={(e) => {
                          setMessageSearchQuery(e.target.value);
                          setMessageSearchIndex(0);
                        }}
                        onKeyDown={(e) => {
                          if (messageSearchMatches.length === 0) return;
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setMessageSearchIndex((prev) => (prev + 1) % messageSearchMatches.length);
                          }
                          if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setMessageSearchIndex((prev) => (prev - 1 + messageSearchMatches.length) % messageSearchMatches.length);
                          }
                        }}
                        placeholder="Sök i konversationen..."
                        className={`flex-1 min-w-0 px-2 py-1.5 text-sm rounded-lg bg-transparent focus:outline-none ${
                          isDarkMode ? 'text-gray-100 placeholder-gray-500' : 'text-[#2d2a26] placeholder-gray-400'
                        }`}
                        autoFocus
                        aria-label="Sök i konversationen"
                      />
                      <span className={`text-xs flex-shrink-0 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {messageSearchQuery.trim()
                          ? messageSearchMatches.length > 0
                            ? `${messageSearchIndex + 1} / ${messageSearchMatches.length}`
                            : '0 träffar'
                          : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setShowMessageSearch(false); setMessageSearchQuery(''); }}
                        className={`p-1.5 rounded-lg ${isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}
                        aria-label="Stäng sök"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {currentBranchId && (
                    <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs ${
                      isDarkMode ? 'bg-gray-800 border border-gray-700 text-gray-300' : 'bg-gray-100 border border-gray-200 text-gray-600'
                    }`}>
                      <span className="flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-[#c0a280]" />
                        Gren – du ser en sidogren av konversationen
                      </span>
                      <button
                        type="button"
                        onClick={() => { setCurrentBranchId(null); setMessages(mainThreadMessages); }}
                        className={`font-medium px-2 py-1 rounded-lg transition-colors ${
                          isDarkMode ? 'text-[#c0a280] hover:bg-gray-700' : 'text-[#8b7355] hover:bg-gray-200'
                        }`}
                      >
                        Visa huvudtråd
                      </button>
                    </div>
                  )}
                  {messages.map((message, index) => {
                    const isLastAssistantMessage = message.role === 'assistant' && 
                      index === messages.length - 1 && 
                      !isLoading;
                    const isSearchHighlight = showMessageSearch && currentMessageSearchMatch === index;
                    
                    return (
                      <div
                        key={message.id}
                        data-message-index={index}
                        className={isSearchHighlight ? 'ring-2 ring-[#c0a280] rounded-2xl ring-offset-2 ring-offset-transparent' : ''}
                      >
                        <MessageBubble 
                        message={message}
                        onRegenerate={stableHandleRegenerate}
                        onFeedback={handleFeedback}
                        onShare={message.role === 'assistant' ? handleOpenShareModal : undefined}
                        onFollowUp={message.role === 'assistant' ? handleFollowUp : undefined}
                        onReformulate={message.role === 'assistant' ? stableHandleReformulate : undefined}
                        onQuote={message.role === 'assistant' ? setQuotedMessage : undefined}
                        onStartBranch={message.role === 'assistant' ? startBranch : undefined}
                        onStartEdit={message.role === 'user' ? setEditingMessageId : undefined}
                        onEditMessage={message.role === 'user' ? stableHandleEditMessage : undefined}
                        onCancelEdit={message.role === 'user' ? handleCancelEdit : undefined}
                        editingMessageId={editingMessageId}
                        showBranchAction={!currentBranchId && !isSharedSession && !!currentSessionId}
                        isDarkMode={isDarkMode}
                        isLastAssistantMessage={isLastAssistantMessage}
                        isSharedSession={isSharedSession}
                      />
                      </div>
                    );
                  })}
                  
                  {isLoading && (
                    <LoadingIndicator
                      characterCount={messages.filter(m => m.role === 'assistant').pop()?.content?.length ?? 0}
                      startTime={streamingStartTimeRef.current}
                      isDarkMode={isDarkMode}
                    />
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Input Area - Mobile Optimized */}
          <div className={`flex-shrink-0 border-t backdrop-blur-sm transition-colors duration-200 ${
            isDarkMode 
              ? 'border-gray-700 bg-gray-800/95' 
              : 'border-gray-100 bg-white/95'
          }`}>
            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
              {/* Clear button */}
              {messages.length > 0 && (
                <div className="flex items-center justify-end mb-2 sm:mb-3">
                  <button
                    onClick={clearChat}
                    className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg transition-colors touch-manipulation ${
                      isDarkMode
                        ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Trash2 className="w-3 h-3" />
                    <span className="hidden xs:inline">Rensa</span>
                  </button>
                </div>
              )}
              
              {/* Attached Files Preview */}
              {attachedFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5 sm:gap-2">
                  {attachedFiles.map((file, index) => (
                    <div 
                      key={index}
                      className={`flex items-center gap-1.5 sm:gap-2 border rounded-lg text-xs overflow-hidden ${
                        file.preview ? 'p-1' : 'px-2 sm:px-3 py-1.5'
                      } ${
                        isDarkMode
                          ? 'bg-gray-700 border-gray-600'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      {file.preview ? (
                        // Show image thumbnail for pasted images
                        <div className="relative group">
                          <img 
                            src={file.preview} 
                            alt={file.name}
                            className="h-12 w-auto max-w-[100px] rounded object-cover"
                          />
                          <button
                            onClick={() => removeFile(index)}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full 
                                       flex items-center justify-center opacity-0 group-hover:opacity-100 
                                       transition-opacity shadow-sm"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        // Show file icon for other files
                        <>
                          {getFileIcon(file.type)}
                          <span className={`max-w-[100px] sm:max-w-[150px] truncate ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>{file.name}</span>
                          <button
                            onClick={() => removeFile(index)}
                            className="text-gray-400 hover:text-red-500 transition-colors touch-manipulation p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Input Box - Larger touch targets */}
              <div className="relative">
                <div className={`relative border rounded-2xl shadow-lg overflow-hidden transition-colors duration-200 ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600'
                    : 'bg-white border-gray-200'
                }`}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.xlsx,.xls,.txt,.csv,.png,.jpg,.jpeg,.webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  {/* Quote chip - show when user has quoted an assistant message */}
                  {quotedMessage && (
                    <div className={`flex items-center gap-2 px-3 py-2 border-b ${
                      isDarkMode ? 'border-gray-600 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                    }`}>
                      <Quote className={`w-3.5 h-3.5 flex-shrink-0 ${isDarkMode ? 'text-[#c0a280]' : 'text-[#8b7355]'}`} />
                      <span className={`text-xs truncate flex-1 min-w-0 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Citerar: {quotedMessage.content.replace(/\s+/g, ' ').slice(0, 60)}
                        {quotedMessage.content.length > 60 ? '...' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuotedMessage(null)}
                        className={`p-1 rounded ${isDarkMode ? 'text-gray-400 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-200'}`}
                        title="Ta bort citat"
                        aria-label="Ta bort citat"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder="Skriv ett meddelande..."
                    rows={1}
                    className={`w-full px-3 sm:px-4 py-3 pl-11 sm:pl-12 pr-12 sm:pr-14 text-sm sm:text-base 
                               resize-none focus:outline-none bg-transparent transition-colors ${
                      isDarkMode
                        ? 'text-white placeholder-gray-500'
                        : 'text-[#2d2a26] placeholder-gray-400'
                    }`}
                    style={{ minHeight: '48px', maxHeight: '120px' }}
                  />
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingFile || isLoading}
                    className={`absolute left-1.5 sm:left-2 bottom-1.5 sm:bottom-2 w-8 h-8 sm:w-9 sm:h-9 rounded-xl
                               disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center touch-manipulation ${
                      isDarkMode
                        ? 'text-gray-400 hover:text-[#c0a280] hover:bg-gray-600'
                        : 'text-gray-400 hover:text-[#c0a280] hover:bg-gray-100'
                    }`}
                    title="Bifoga fil"
                    aria-label="Bifoga fil"
                  >
                    {isProcessingFile ? (
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    ) : (
                      <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </button>
                  
                  {/* Voice input button */}
                  {voiceSupported && (
                    <button
                      onClick={toggleVoiceInput}
                      disabled={isLoading}
                      className={`absolute right-11 sm:right-12 bottom-1.5 sm:bottom-2 w-8 h-8 sm:w-9 sm:h-9 rounded-xl 
                                 transition-all flex items-center justify-center touch-manipulation
                                 ${isListening 
                                   ? 'bg-red-500 text-white animate-pulse' 
                                   : isDarkMode
                                     ? 'text-gray-400 hover:text-[#c0a280] hover:bg-gray-600'
                                     : 'text-gray-400 hover:text-[#c0a280] hover:bg-gray-100'
                                 } disabled:opacity-40 disabled:cursor-not-allowed`}
                      title={isListening ? 'Stoppa röstinmatning' : 'Starta röstinmatning'}
                    >
                      {isListening ? (
                        <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </button>
                  )}
                  
                  <button
                    onClick={handleSend}
                    disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
                    className={`absolute right-1.5 sm:right-2 bottom-1.5 sm:bottom-2 w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-white
                               disabled:opacity-40 disabled:cursor-not-allowed
                               active:scale-95 transition-all flex items-center justify-center shadow-md touch-manipulation ${
                      isDarkMode
                        ? 'bg-[#c0a280] hover:bg-[#d4b896]'
                        : 'bg-[#2d2a26] hover:bg-[#3d3a36]'
                    }`}
                  >
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
              
              {/* Markdown preview - small collapsible preview of input */}
              {showInputPreview && input.trim() && (
                <div
                  className={`mt-2 rounded-xl border overflow-hidden max-h-40 overflow-y-auto ${
                    isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className={`px-3 py-2 text-sm leading-relaxed ${
                    isDarkMode ? 'text-gray-100' : 'text-[#2d2a26]'
                  }`}>
                    {formatMarkdown(input)}
                  </div>
                </div>
              )}
              
              {/* Footer - Hidden on mobile, shown on larger screens */}
              <p className={`hidden sm:flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] mt-2 transition-colors ${
                isDarkMode ? 'text-gray-500' : 'text-gray-400'
              }`}>
                <button
                  type="button"
                  onClick={() => setShowInputPreview(!showInputPreview)}
                  className={`underline hover:no-underline ${
                    showInputPreview ? (isDarkMode ? 'text-[#c0a280]' : 'text-[#8b7355]') : ''
                  }`}
                >
                  {showInputPreview ? 'Dölj förhandsgranskning' : 'Förhandsgranska markdown'}
                </button>
                <span className="hidden sm:inline">•</span>
                All data stannar inom ert AWS-konto
                <span className="mx-0.5">•</span>
                <kbd className={`px-1 py-0.5 rounded text-[8px] font-mono ${
                  isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                }`}>⌘K</kbd> Ny chatt
                <span className="mx-0.5">•</span>
                <kbd className={`px-1 py-0.5 rounded text-[8px] font-mono ${
                  isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                }`}>Esc</kbd> Rensa
                <span className="mx-0.5">•</span>
                <kbd className={`px-1 py-0.5 rounded text-[8px] font-mono ${
                  isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                }`}>⌘D</kbd> Mörkt läge
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Chat History Sidebar */}
        <div className={`w-72 border-l flex-shrink-0 hidden lg:flex flex-col transition-colors duration-200 ${
          isDarkMode 
            ? 'border-gray-700 bg-gray-800' 
            : 'border-gray-200 bg-white'
        }`}>
          <div className={`p-4 border-b transition-colors ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`font-medium text-sm transition-colors ${
                isDarkMode ? 'text-white' : 'text-[#2d2a26]'
              }`}>Chatthistorik</h3>
              <button
                onClick={startNewChat}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                  isDarkMode
                    ? 'text-[#d4b896] hover:bg-[#c0a280]/20'
                    : 'text-[#c0a280] hover:bg-[#c0a280]/10'
                }`}
                title="Ny chatt (⌘K)"
                aria-label="Ny chatt"
              >
                <Plus className="w-3.5 h-3.5" />
                Ny chatt
              </button>
            </div>
            
            <div className="relative">
              <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${
                isDarkMode ? 'text-gray-500' : 'text-gray-400'
              }`} />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Sök i titel och innehåll..."
                className={`w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg
                         focus:outline-none focus:border-[#c0a280] focus:ring-1 focus:ring-[#c0a280]/20 transition-colors ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-500'
                    : 'bg-gray-50 border-gray-200 text-[#2d2a26] placeholder:text-gray-400'
                }`}
              />
              {historySearch && (
                <button
                  onClick={() => setHistorySearch('')}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 ${
                    isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {isLoadingSessions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className={`w-5 h-5 animate-spin ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`} />
              </div>
            ) : displayedSessions.length === 0 ? (
              <div className="text-center py-8 px-4">
                <MessageSquare className={`w-8 h-8 mx-auto mb-2 ${
                  isDarkMode ? 'text-gray-600' : 'text-gray-300'
                }`} />
                <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Inga tidigare chattar</p>
                <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}>Dina konversationer sparas här</p>
              </div>
            ) : (
              <div className="space-y-1">
                {displayedSessions.map((session) => (
                  <button
                    key={session.sessionId}
                    onClick={() => loadSession(session.sessionId)}
                    className={`w-full text-left p-3 rounded-lg transition-all group relative ${
                      currentSessionId === session.sessionId
                        ? isDarkMode
                          ? 'bg-[#c0a280]/20 border border-[#c0a280]/40'
                          : 'bg-[#c0a280]/15 border border-[#c0a280]/30'
                        : isDarkMode
                          ? 'hover:bg-gray-700 border border-transparent'
                          : 'hover:bg-gray-50 hover:shadow-sm border border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isDarkMode ? 'bg-[#c0a280]/30 text-[#c0a280]' : 'bg-[#c0a280]/20 text-[#8b7355]'
                      }`}>
                        {session.pinned ? (
                          <Pin className="w-3 h-3" />
                        ) : (
                          <Bot className="w-3 h-3" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingSessionId === session.sessionId ? (
                          <input
                            type="text"
                            value={editingSessionTitle}
                            onChange={e => setEditingSessionTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                renameSession(session.sessionId, editingSessionTitle);
                              }
                              if (e.key === 'Escape') {
                                setEditingSessionId(null);
                                setEditingSessionTitle('');
                              }
                            }}
                            onBlur={() => {
                              if (editingSessionTitle.trim()) renameSession(session.sessionId, editingSessionTitle);
                              else { setEditingSessionId(null); setEditingSessionTitle(''); }
                            }}
                            onClick={e => e.stopPropagation()}
                            className={`w-full text-xs font-medium px-1 py-0.5 rounded border min-w-0 ${
                              isDarkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-[#2d2a26]'
                            }`}
                            autoFocus
                            aria-label="Byt namn på konversation"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5 group/title">
                            <p className={`text-xs font-medium truncate flex-1 min-w-0 ${
                              isDarkMode ? 'text-white' : 'text-[#2d2a26]'
                            }`}>
                              {session.title}
                            </p>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setEditingSessionId(session.sessionId); setEditingSessionTitle(session.title || ''); }}
                              className={`p-0.5 rounded flex-shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity ${
                                isDarkMode ? 'text-gray-500 hover:bg-gray-700' : 'text-gray-400 hover:bg-gray-100'
                              }`}
                              title="Byt namn"
                              aria-label="Byt namn på konversation"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <p className={`text-[10px] flex items-center gap-1 mt-0.5 ${
                          isDarkMode ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          <Clock className="w-2.5 h-2.5" />
                          {formatTimeAgo(session.updatedAt)}
                        </p>
                        {(session.tags?.length || addingTagSessionId === session.sessionId) ? (
                          <div className="flex flex-wrap items-center gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
                            {(session.tags || []).map(tag => (
                              <span
                                key={tag}
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] ${
                                  isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => updateSessionTags(session.sessionId, (session.tags || []).filter(t => t !== tag))}
                                  className="hover:opacity-70"
                                  aria-label={`Ta bort ${tag}`}
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            ))}
                            {addingTagSessionId === session.sessionId ? (
                              <input
                                type="text"
                                value={newTagInput}
                                onChange={e => setNewTagInput(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    const t = newTagInput.trim();
                                    if (t) updateSessionTags(session.sessionId, [...(session.tags || []), t]);
                                    setNewTagInput('');
                                    setAddingTagSessionId(null);
                                  }
                                  if (e.key === 'Escape') setAddingTagSessionId(null);
                                }}
                                onBlur={() => {
                                  const t = newTagInput.trim();
                                  if (t) updateSessionTags(session.sessionId, [...(session.tags || []), t]);
                                  setNewTagInput('');
                                  setAddingTagSessionId(null);
                                }}
                                placeholder="Tagg..."
                                className={`w-16 min-w-0 px-1 py-0.5 text-[10px] border rounded ${
                                  isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'
                                }`}
                                autoFocus
                              />
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => { setAddingTagSessionId(session.sessionId); setNewTagInput(''); }}
                                  className={`p-0.5 rounded ${isDarkMode ? 'text-gray-500 hover:bg-gray-700' : 'text-gray-400 hover:bg-gray-200'}`}
                                  title="Lägg till tagg"
                                  aria-label="Lägg till tagg"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => suggestTags(session.sessionId)}
                                  className={`text-[10px] ${isDarkMode ? 'text-gray-500 hover:text-violet-400' : 'text-gray-400 hover:text-violet-600'}`}
                                  title="Föreslå taggar"
                                  aria-label="Föreslå taggar"
                                >
                                  Föreslå
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => { setAddingTagSessionId(session.sessionId); setNewTagInput(''); }}
                              className={`p-0.5 rounded text-[10px] ${isDarkMode ? 'text-gray-500 hover:bg-gray-700' : 'text-gray-400 hover:bg-gray-200'}`}
                              title="Lägg till tagg"
                              aria-label="Lägg till tagg"
                            >
                              + Tagg
                            </button>
                            <button
                              type="button"
                              onClick={() => suggestTags(session.sessionId)}
                              className={`text-[10px] ${isDarkMode ? 'text-gray-500 hover:text-violet-400' : 'text-gray-400 hover:text-violet-600'}`}
                              title="Föreslå taggar"
                              aria-label="Föreslå taggar"
                            >
                              Föreslå taggar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePin(session.sessionId); }}
                      className={`absolute right-9 top-1/2 -translate-y-1/2 p-1.5 rounded-lg
                                 opacity-0 group-hover:opacity-100 transition-all ${
                        session.pinned
                          ? isDarkMode ? 'text-[#c0a280] bg-[#c0a280]/20' : 'text-[#8b7355] bg-[#c0a280]/15'
                          : isDarkMode
                            ? 'text-gray-500 hover:text-[#c0a280] hover:bg-[#c0a280]/20'
                            : 'text-gray-300 hover:text-[#8b7355] hover:bg-[#c0a280]/10'
                      }`}
                      title={session.pinned ? 'Avfäst' : 'Fäst överst'}
                    >
                      {session.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); confirmDeleteSession(session.sessionId); }}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg
                                 opacity-0 group-hover:opacity-100 transition-all ${
                        isDarkMode
                          ? 'text-gray-500 hover:text-red-400 hover:bg-red-900/30'
                          : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                      }`}
                      title="Ta bort"
                      aria-label="Ta bort chatt"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </button>
                ))}
              </div>
            )}
            
            {hasMoreSessions && (
              <button
                type="button"
                onClick={loadMoreSessions}
                disabled={isLoadingSessions}
                className={`w-full mt-2 py-2 text-xs rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50 ${
                  isDarkMode
                    ? 'text-[#d4b896] hover:bg-[#c0a280]/20'
                    : 'text-[#c0a280] hover:bg-[#c0a280]/10'
                }`}
              >
                {isLoadingSessions ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Ladda fler
              </button>
            )}
            
            {sortedFilteredSessions.length > 5 && (
              <button
                onClick={() => setShowAllSessions(!showAllSessions)}
                className={`w-full mt-2 py-2 text-xs rounded-lg transition-colors flex items-center justify-center gap-1 ${
                  isDarkMode
                    ? 'text-[#d4b896] hover:bg-[#c0a280]/20'
                    : 'text-[#c0a280] hover:bg-[#c0a280]/10'
                }`}
              >
                {showAllSessions ? 'Visa färre' : `Visa ${sortedFilteredSessions.length - 5} fler`}
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showAllSessions ? 'rotate-90' : ''}`} />
              </button>
            )}
          </div>
          
          <div className={`p-3 border-t transition-colors ${
            isDarkMode 
              ? 'border-gray-700 bg-gray-900/50' 
              : 'border-gray-200 bg-gray-50'
          }`}>
            <p className={`text-[10px] text-center ${
              isDarkMode ? 'text-gray-500' : 'text-gray-400'
            }`}>
              Chattar sparas säkert i ditt konto
            </p>
          </div>
        </div>
      </div>

      {showBottomNav && <MobileBottomNav />}
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export function FullscreenChatPage() {
  return (
    <Suspense fallback={
      <div className="h-[100dvh] flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#c0a280] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Laddar chatt...</p>
        </div>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}
