'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Copy,
  Check,
  Sparkles,
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
  Zap,
  Upload,
  MessageSquare,
  Plus,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Search,
  Command,
  Mic,
  MicOff,
  Image as ImageIcon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useVoiceInput } from '@/hooks/useVoiceInput';

// ============================================================================
// Types
// ============================================================================

type AgentMode = 'regelverksassistent' | 'claude' | 'chatgpt';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  confidence?: number;
  timestamp: string;
  mode: AgentMode;
  attachments?: AttachedFile[];
  feedback?: 'positive' | 'negative' | null;
}

interface AttachedFile {
  name: string;
  type: string;
  size: number;
  content?: string; // Extracted text content
  preview?: string; // Base64 image preview for images
}

interface Citation {
  documentTitle: string;
  documentNumber?: string;
  section?: string;
  excerpt: string;
  sourceUrl: string;
}

interface ChatSession {
  sessionId: string;
  title: string;
  mode: AgentMode;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

const EXAMPLE_QUESTIONS: Record<AgentMode, string[]> = {
  regelverksassistent: [
    'Vilka krav gäller för AIFM Annex IV-rapportering?',
    'Vad säger FFFS 2013:10 om riskhantering?',
    'Vilka PAI-indikatorer är obligatoriska enligt SFDR?',
  ],
  claude: [
    'Hjälp mig analysera denna investeringsstrategi',
    'Förklara skillnaden mellan UCITS och AIF',
    'Sammanfatta de viktigaste regulatoriska ändringarna 2026',
  ],
  chatgpt: [
    'Skriv en sammanfattning av denna årsrapport',
    'Hjälp mig med kodgranskning och optimering',
    'Analysera dessa finansiella nyckeltal',
  ],
};

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
    
    // Handle # header - convert to bold large
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      elements.push(
        <span key={`h1-${i}`} className="font-bold text-[#2d2a26] text-base block mt-4 mb-2">
          {formatInlineMarkdown(line.slice(2))}
        </span>
      );
    }
    // Handle ## headers - convert to bold
    else if (line.startsWith('## ') && !line.startsWith('### ')) {
      elements.push(
        <span key={`h2-${i}`} className="font-semibold text-[#2d2a26] block mt-3 mb-1">
          {formatInlineMarkdown(line.slice(3))}
        </span>
      );
    }
    // Handle ### headers - convert to bold (slightly smaller)
    else if (line.startsWith('### ') && !line.startsWith('#### ')) {
      elements.push(
        <span key={`h3-${i}`} className="font-semibold text-[#2d2a26] block mt-2 mb-1">
          {formatInlineMarkdown(line.slice(4))}
        </span>
      );
    }
    // Handle #### headers - convert to bold (smaller)
    else if (line.startsWith('#### ') && !line.startsWith('##### ')) {
      elements.push(
        <span key={`h4-${i}`} className="font-semibold text-[#2d2a26] text-sm block mt-2 mb-1">
          {formatInlineMarkdown(line.slice(5))}
        </span>
      );
    }
    // Handle ##### headers
    else if (line.startsWith('##### ')) {
      elements.push(
        <span key={`h5-${i}`} className="font-medium text-[#2d2a26] text-sm block mt-1.5 mb-0.5">
          {formatInlineMarkdown(line.slice(6))}
        </span>
      );
    }
    // Handle bullet points
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <span key={`li-${i}`} className="block ml-3">
          • {formatInlineMarkdown(line.slice(2))}
        </span>
      );
    }
    // Handle numbered lists
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
    // Regular line
    else if (line.trim()) {
      elements.push(
        <span key={`p-${i}`} className="block">
          {formatInlineMarkdown(line)}
        </span>
      );
    }
    // Empty line - add spacing
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
    // Find the first match of any type
    // Improved link regex to handle URLs with special chars like ? and =
    const linkMatch = remaining.match(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/);
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Also detect plain URLs not in markdown format
    const plainUrlMatch = remaining.match(/(?<!\]\()https?:\/\/[^\s<>\)\]]+/);
    
    // Find which match comes first
    const matches = [
      { type: 'link', match: linkMatch, index: linkMatch?.index ?? Infinity },
      { type: 'bold', match: boldMatch, index: boldMatch?.index ?? Infinity },
      { type: 'code', match: codeMatch, index: codeMatch?.index ?? Infinity },
      { type: 'plainUrl', match: plainUrlMatch, index: plainUrlMatch?.index ?? Infinity },
    ].filter(m => m.match !== null).sort((a, b) => a.index - b.index);
    
    if (matches.length === 0) {
      // No more matches, add remaining text
      parts.push(remaining);
      break;
    }
    
    const first = matches[0];
    
    // Add text before the match
    if (first.index > 0) {
      parts.push(remaining.slice(0, first.index));
    }
    
    if (first.type === 'link' && first.match) {
      const [fullMatch, linkText, linkUrl] = first.match;
      // Clean URL - remove trailing punctuation that might have been captured
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
      // Clean URL - remove trailing punctuation
      const cleanUrl = url.replace(/[.,;:!?]+$/, '');
      const trailingPunctuation = url.slice(cleanUrl.length);
      // Create display text from URL
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
// Message Component
// ============================================================================

interface MessageBubbleProps {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
  isLastAssistantMessage?: boolean;
}

function MessageBubble({ message, onRegenerate, onFeedback, isLastAssistantMessage }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [localFeedback, setLocalFeedback] = useState<'positive' | 'negative' | null>(message.feedback || null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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

  // Extract title from content (first line or heading)
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

  // Parse content for structured data (tables)
  const parseTableData = () => {
    const lines = message.content.split('\n');
    const tables: Array<{ name: string; headers: string[]; data: string[][] }> = [];
    let currentTable: { name: string; headers: string[]; data: string[][] } | null = null;
    let lastHeading = 'Data';

    for (const line of lines) {
      // Track headings for table names
      if (line.startsWith('## ') || line.startsWith('### ')) {
        lastHeading = line.replace(/^#+\s*/, '').trim();
      }
      
      // Detect table row (contains |)
      if (line.includes('|') && line.trim().startsWith('|')) {
        const cells = line.split('|').map(c => c.trim()).filter(c => c && !c.match(/^-+$/));
        
        if (cells.length > 0) {
          // Check if separator row
          if (cells.every(c => c.match(/^-+$/))) continue;
          
          if (!currentTable) {
            // First row is headers
            currentTable = { name: lastHeading, headers: cells, data: [] };
          } else if (currentTable.headers.length === cells.length) {
            // Data row
            currentTable.data.push(cells);
          }
        }
      } else if (currentTable && currentTable.data.length > 0) {
        // End of table
        tables.push(currentTable);
        currentTable = null;
      }
    }
    
    // Don't forget last table
    if (currentTable && currentTable.data.length > 0) {
      tables.push(currentTable);
    }

    return tables;
  };

  const exportToPDF = async () => {
    setExporting('pdf');
    try {
      const title = extractTitle();
      
      // Parse sections from content
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
    }
    setExporting(null);
  };

  const exportToExcel = async () => {
    setExporting('excel');
    try {
      const title = extractTitle();
      const tables = parseTableData();
      
      // If no tables found, create one sheet with the content as rows
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
    }
    setExporting(null);
  };
  
  if (message.role === 'user') {
    return (
      <div className="flex justify-end gap-3 animate-fade-in">
        <div className="max-w-[80%] bg-[#2d2a26] text-white rounded-2xl rounded-tr-md px-4 py-3 shadow-lg">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#c0a280] to-[#8a7355] flex items-center justify-center flex-shrink-0 shadow-md">
          <User className="w-3.5 h-3.5 text-white" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${
        message.mode === 'regelverksassistent' 
          ? 'bg-gradient-to-br from-emerald-500 to-emerald-700' 
          : message.mode === 'chatgpt'
          ? 'bg-gradient-to-br from-green-500 to-teal-600'
          : 'bg-gradient-to-br from-violet-500 to-purple-700'
      }`}>
        {message.mode === 'regelverksassistent' ? (
          <BookOpen className="w-3.5 h-3.5 text-white" />
        ) : message.mode === 'chatgpt' ? (
          <Zap className="w-3.5 h-3.5 text-white" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 text-white" />
        )}
      </div>
      <div className="max-w-[80%]">
        <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
          <div className="text-sm text-[#2d2a26] leading-relaxed">{formatMarkdown(message.content)}</div>
          
          {message.citations && message.citations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-3.5 h-3.5 text-[#c0a280]" />
                <p className="text-[11px] font-medium text-[#2d2a26]">
                  Källor från kunskapsbasen ({message.citations.length})
                </p>
              </div>
              <div className="space-y-2">
                {message.citations.map((citation, i) => (
                  <div 
                    key={i}
                    className="p-2.5 bg-gradient-to-r from-[#c0a280]/5 to-transparent rounded-lg border border-[#c0a280]/20 hover:border-[#c0a280]/40 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#c0a280]/20 text-[#c0a280] text-[10px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#2d2a26] text-xs truncate">{citation.documentTitle}</span>
                          {citation.documentNumber && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{citation.documentNumber}</span>
                          )}
                        </div>
                        {citation.excerpt && (
                          <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{citation.excerpt}</p>
                        )}
                        {citation.sourceUrl && citation.sourceUrl !== '#' && (
                          <a 
                            href={citation.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-[#c0a280] hover:underline mt-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Öppna källa
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Regenerate button - only show on last assistant message */}
              {isLastAssistantMessage && onRegenerate && (
                <button 
                  onClick={() => onRegenerate(message.id)}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 hover:text-[#c0a280] 
                           hover:bg-[#c0a280]/10 rounded-md transition-colors"
                  title="Generera nytt svar"
                >
                  <RefreshCw className="w-3 h-3" />
                  Regenerera
                </button>
              )}
              
              {/* Feedback buttons */}
              <div className="flex items-center gap-0.5 border-l border-gray-100 pl-2 ml-1">
                <button 
                  onClick={() => handleFeedback('positive')}
                  className={`p-1.5 rounded-md transition-colors ${
                    localFeedback === 'positive' 
                      ? 'text-green-600 bg-green-50' 
                      : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                  }`}
                  title="Bra svar"
                >
                  <ThumbsUp className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => handleFeedback('negative')}
                  className={`p-1.5 rounded-md transition-colors ${
                    localFeedback === 'negative' 
                      ? 'text-red-600 bg-red-50' 
                      : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                  }`}
                  title="Dåligt svar"
                >
                  <ThumbsDown className="w-3 h-3" />
                </button>
              </div>
              
              <div className="border-l border-gray-100 pl-2 ml-1 flex items-center gap-2">
                <button 
                  onClick={exportToPDF}
                  disabled={exporting !== null}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 hover:text-red-600 
                           hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                  title="Exportera till PDF"
                >
                  {exporting === 'pdf' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <FileText className="w-3 h-3" />
                  )}
                  PDF
                </button>
                <button 
                  onClick={exportToExcel}
                  disabled={exporting !== null}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 hover:text-green-600 
                           hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
                  title="Exportera till Excel"
                >
                  {exporting === 'excel' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3 h-3" />
                  )}
                  Excel
                </button>
              </div>
            </div>
            <button 
              onClick={copyToClipboard}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#c0a280] transition-colors"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Kopierat' : 'Kopiera'}
            </button>
            <button 
              onClick={toggleSpeak}
              className={`flex items-center gap-1 text-[10px] transition-colors ${
                isSpeaking 
                  ? 'text-[#c0a280] animate-pulse' 
                  : 'text-gray-400 hover:text-[#c0a280]'
              }`}
            >
              {isSpeaking ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              {isSpeaking ? 'Stoppa' : 'Läs upp'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Loading Animation
// ============================================================================

function LoadingIndicator({ mode }: { mode: AgentMode }) {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${
        mode === 'regelverksassistent' 
          ? 'bg-gradient-to-br from-emerald-500 to-emerald-700' 
          : mode === 'chatgpt'
          ? 'bg-gradient-to-br from-green-500 to-teal-600'
          : 'bg-gradient-to-br from-violet-500 to-purple-700'
      }`}>
        {mode === 'regelverksassistent' ? (
          <BookOpen className="w-3.5 h-3.5 text-white" />
        ) : mode === 'chatgpt' ? (
          <Zap className="w-3.5 h-3.5 text-white" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 text-white" />
        )}
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-[#c0a280] animate-spin" />
          <span className="text-sm text-gray-400">
            {mode === 'regelverksassistent' ? 'Söker i regelverk...' : mode === 'chatgpt' ? 'ChatGPT tänker...' : 'Tänker...'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Mode Toggle
// ============================================================================

function ModeToggle({ mode, onChange }: { mode: AgentMode; onChange: (mode: AgentMode) => void }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
      <button
        onClick={() => onChange('regelverksassistent')}
        className={`flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          mode === 'regelverksassistent'
            ? 'bg-white text-[#2d2a26] shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <BookOpen className="w-4 h-4" />
        <span className="hidden sm:inline">Regelverk</span>
      </button>
      <button
        onClick={() => onChange('claude')}
        className={`flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          mode === 'claude'
            ? 'bg-white text-[#2d2a26] shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <Sparkles className="w-4 h-4" />
        <span className="hidden sm:inline">Claude 4.6</span>
      </button>
      <button
        onClick={() => onChange('chatgpt')}
        className={`flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          mode === 'chatgpt'
            ? 'bg-white text-[#2d2a26] shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <Zap className="w-4 h-4" />
        <span className="hidden sm:inline">ChatGPT</span>
      </button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

// File type icons
function getFileIcon(type: string) {
  if (type.includes('pdf')) return <FileText className="w-4 h-4" />;
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return <FileSpreadsheet className="w-4 h-4" />;
  if (type.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
}

// Supported file types
const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
];

export default function AIFMAgentPage() {
  const [mode, setMode] = useState<AgentMode>('claude');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  // Voice input
  const {
    isListening,
    isSupported: isVoiceSupported,
    transcript,
    interimTranscript,
    error: voiceError,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceInput({
    language: 'sv-SE',
    continuous: true,
    onResult: (text) => {
      // Append transcribed text to input
      setInput(prev => prev + (prev ? ' ' : '') + text);
    },
    onEnd: () => {
      // Voice recording ended
    },
  });
  
  // Chat history state
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);
  const isUserScrollingRef = useRef(false);
  const lastScrollTopRef = useRef(0);

  // Load chat sessions on mount
  useEffect(() => {
    loadChatSessions();
  }, []);

  // Keyboard shortcuts: Cmd+K for new chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (or Ctrl+K) - New chat
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Inline the startNewChat logic to avoid closure issues
        setMessages([]);
        setCurrentSessionId(null);
        setInput('');
        setAttachedFiles([]);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track if user is scrolling up
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      // User scrolled up if they moved away from bottom
      if (scrollTop < lastScrollTopRef.current && !isNearBottom) {
        isUserScrollingRef.current = true;
      }
      
      // User scrolled back to bottom
      if (isNearBottom) {
        isUserScrollingRef.current = false;
      }
      
      lastScrollTopRef.current = scrollTop;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to bottom only if user is not scrolling
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Load chat sessions from API
  const loadChatSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const response = await fetch('/api/chat/sessions?limit=20');
      if (response.ok) {
        const data = await response.json();
        setChatSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    }
    setIsLoadingSessions(false);
  };

  // Save current session
  const saveSession = async (newMessages: Message[]) => {
    if (newMessages.length === 0) return;
    
    try {
      const title = newMessages[0]?.content?.slice(0, 50) + (newMessages[0]?.content?.length > 50 ? '...' : '');
      
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          title,
          mode,
          messages: newMessages,
        }),
      });
      
      if (response.ok) {
        const session = await response.json();
        setCurrentSessionId(session.sessionId);
        
        // Update sessions list
        setChatSessions(prev => {
          const filtered = prev.filter(s => s.sessionId !== session.sessionId);
          return [session, ...filtered];
        });
      }
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  };

  // Load a specific session
  const loadSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat/sessions?sessionId=${sessionId}`);
      if (response.ok) {
        const session = await response.json();
        setMessages(session.messages || []);
        setMode(session.mode || 'claude');
        setCurrentSessionId(sessionId);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  // Start new chat
  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setInput('');
    setAttachedFiles([]);
  };

  // Delete a session
  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/chat/sessions?sessionId=${sessionId}`, { method: 'DELETE' });
      setChatSessions(prev => prev.filter(s => s.sessionId !== sessionId));
      if (currentSessionId === sessionId) {
        startNewChat();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  // Regenerate response for a message
  const handleRegenerate = async (messageId: string) => {
    // Find the index of the assistant message to regenerate
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    
    // Find the previous user message
    const userMessageIndex = messageIndex - 1;
    if (userMessageIndex < 0 || messages[userMessageIndex].role !== 'user') return;
    
    const userMessage = messages[userMessageIndex];
    
    // Remove the assistant message we're regenerating
    const messagesWithoutResponse = messages.slice(0, messageIndex);
    setMessages(messagesWithoutResponse);
    
    // Reset scroll state
    isUserScrollingRef.current = false;
    setIsLoading(true);
    
    // Create new placeholder for streaming response
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
      const endpoint = mode === 'regelverksassistent' 
        ? '/api/compliance/chat'
        : mode === 'chatgpt'
        ? '/api/ai/chat-gpt'
        : '/api/ai/chat';
      
      const useStreaming = mode !== 'regelverksassistent';
      
      // Extract original message content (without file attachment text)
      let originalContent = userMessage.content;
      if (originalContent.includes('📎 Bifogade filer:')) {
        originalContent = originalContent.split('📎 Bifogade filer:')[0].trim();
      }
      
      // Add file context back if there were attachments
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
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') break;
                
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.text) {
                    fullContent += parsed.text;
                    setMessages(prev => prev.map(m => 
                      m.id === newAssistantMessageId 
                        ? { ...m, content: fullContent }
                        : m
                    ));
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
          }
        }
        
        const finalMessages = [...messagesWithoutResponse, { ...newAssistantMessage, content: fullContent }];
        setMessages(finalMessages);
        saveSession(finalMessages);
      } else {
        const data = await response.json();
        const finalContent = data.answer || data.response || data.content || 'Inget svar mottogs.';
        
        setMessages(prev => prev.map(m => 
          m.id === newAssistantMessageId 
            ? { ...m, content: finalContent, citations: data.citations, confidence: data.confidence }
            : m
        ));
        
        const finalMessages = [...messagesWithoutResponse, { 
          ...newAssistantMessage, 
          content: finalContent,
          citations: data.citations,
          confidence: data.confidence,
        }];
        saveSession(finalMessages);
      }
      
    } catch (error) {
      console.error('Regenerate error:', error);
      setMessages(prev => prev.map(m => 
        m.id === newAssistantMessageId 
          ? { ...m, content: 'Kunde inte generera nytt svar. Försök igen.' }
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle feedback on a message
  const handleFeedback = async (messageId: string, feedback: 'positive' | 'negative') => {
    // Update local state
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, feedback } : m
    ));
    
    // Optionally save feedback to backend
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
      // Silently fail - feedback is not critical
      console.error('Failed to save feedback:', error);
    }
  };

  // Filter sessions based on search
  const filteredSessions = chatSessions.filter(session => {
    if (!historySearch.trim()) return true;
    const searchLower = historySearch.toLowerCase();
    return session.title.toLowerCase().includes(searchLower) ||
           session.messages?.some(m => m.content.toLowerCase().includes(searchLower));
  });

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setInput(textarea.value);
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
  }, []);

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFile(true);
    
    for (const file of Array.from(files)) {
      // Check file type
      if (!SUPPORTED_FILE_TYPES.includes(file.type) && !file.name.endsWith('.txt')) {
        alert(`Filtypen ${file.type || file.name.split('.').pop()} stöds inte ännu.`);
        continue;
      }

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Filen är för stor. Max 10MB.');
        continue;
      }

      try {
        // Create base64 preview for images
        let previewDataUrl: string | undefined;
        if (file.type.startsWith('image/')) {
          previewDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        }

        // Create form data
        const formData = new FormData();
        formData.append('file', file);

        // Parse file on server
        const response = await fetch('/api/ai/parse-file', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Kunde inte läsa filen');
        }

        const data = await response.json();

        setAttachedFiles(prev => [...prev, {
          name: file.name,
          type: file.type,
          size: file.size,
          content: data.content,
          preview: previewDataUrl,
        }]);
      } catch (error) {
        console.error('File processing error:', error);
        alert(`Kunde inte bearbeta filen: ${file.name}`);
      }
    }

    setIsProcessingFile(false);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle drag events for entire page
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
      // Check file type
      const isSupported = SUPPORTED_FILE_TYPES.includes(file.type) || 
        file.name.endsWith('.txt') || 
        file.name.endsWith('.xlsx') || 
        file.name.endsWith('.xls') ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.pdf') ||
        file.name.endsWith('.docx');

      if (!isSupported) {
        alert(`Filtypen ${file.type || file.name.split('.').pop()} stöds inte ännu.`);
        continue;
      }

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Filen är för stor. Max 10MB.');
        continue;
      }

      try {
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

        const response = await fetch('/api/ai/parse-file', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Kunde inte läsa filen');
        }

        const data = await response.json();

        setAttachedFiles(prev => [...prev, {
          name: file.name,
          type: file.type,
          size: file.size,
          content: data.content,
          preview: previewDataUrl,
        }]);
      } catch (error) {
        console.error('File processing error:', error);
        alert(`Kunde inte bearbeta filen: ${file.name}`);
      }
    }

    setIsProcessingFile(false);
  }, []);

  // Handle paste from clipboard (for images)
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // First, check for files copied from file explorer
    const files = clipboardData.files;
    if (files && files.length > 0) {
      e.preventDefault();
      setIsProcessingFile(true);

      for (const file of Array.from(files)) {
        // Check if file type is supported
        const isSupported = SUPPORTED_FILE_TYPES.includes(file.type) || 
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

        if (!isSupported) {
          alert(`Filtypen ${file.type || file.name.split('.').pop()} stöds inte ännu.`);
          continue;
        }

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert('Filen är för stor. Max 10MB.');
          continue;
        }

        try {
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

          const response = await fetch('/api/ai/parse-file', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('Kunde inte bearbeta filen');
          }

          const data = await response.json();

          setAttachedFiles(prev => [...prev, {
            name: file.name,
            type: file.type,
            size: file.size,
            content: data.content,
            preview: previewDataUrl,
          }]);
        } catch (error) {
          console.error('Paste file error:', error);
          alert(`Kunde inte klistra in filen: ${file.name}`);
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

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Bilden är för stor. Max 10MB.');
        continue;
      }

      try {
        // Generate a filename for the pasted image
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = file.type.split('/')[1] || 'png';
        const fileName = `screenshot-${timestamp}.${extension}`;

        // Create base64 preview
        const previewDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        // Create a new file with the generated name
        const namedFile = new File([file], fileName, { type: file.type });

        const formData = new FormData();
        formData.append('file', namedFile);

        const response = await fetch('/api/ai/parse-file', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Kunde inte bearbeta bilden');
        }

        const data = await response.json();

        setAttachedFiles(prev => [...prev, {
          name: fileName,
          type: file.type,
          size: file.size,
          content: data.content,
          preview: previewDataUrl,
        }]);
      } catch (error) {
        console.error('Paste image error:', error);
        alert('Kunde inte klistra in bilden');
      }
    }

    setIsProcessingFile(false);
  }, []);

  // Remove attached file
  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;
    
    // Reset scroll state when user sends a message - allow auto-scroll again
    isUserScrollingRef.current = false;
    
    // Build user message content including file info
    let displayContent = input.trim();
    if (attachedFiles.length > 0) {
      const fileNames = attachedFiles.map(f => f.name).join(', ');
      displayContent = displayContent 
        ? `${displayContent}\n\n📎 Bifogade filer: ${fileNames}`
        : `📎 Bifogade filer: ${fileNames}`;
    }
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: displayContent,
      timestamp: new Date().toISOString(),
      mode,
      attachments: attachedFiles.length > 0 ? [...attachedFiles] : undefined,
    };
    
    // Separate image files from document files for proper handling
    const imageFiles = attachedFiles.filter(f => f.type.startsWith('image/'));
    const documentFiles = attachedFiles.filter(f => !f.type.startsWith('image/'));
    
    // Build context with file contents for the API (documents only)
    let messageWithContext = input.trim();
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
    
    // Add user message immediately
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setAttachedFiles([]);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    setIsLoading(true);
    
    // Create placeholder for streaming response
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      mode,
    };
    
    // Add empty assistant message that will be filled with streaming content
    setMessages(prev => [...prev, assistantMessage]);
    
    try {
      const endpoint = mode === 'regelverksassistent' 
        ? '/api/compliance/chat'
        : mode === 'chatgpt'
        ? '/api/ai/chat-gpt'
        : '/api/ai/chat';
      
      const useStreaming = mode !== 'regelverksassistent';
      
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
        }),
      });
      setDeepAnalysis(false);
      
      if (!response.ok) throw new Error('Failed to get response');
      
      // Handle streaming response for Claude and ChatGPT
      if (useStreaming && response.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let streamCitations: Citation[] = [];
        
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                
                if (data === '[DONE]') {
                  // Stream complete
                  break;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  
                  // Handle metadata with citations
                  if (parsed.meta && parsed.citations) {
                    streamCitations = parsed.citations;
                  }
                  
                  // Handle final message with citations
                  if (parsed.done && parsed.citations) {
                    streamCitations = parsed.citations;
                  }
                  
                  if (parsed.text) {
                    fullContent += parsed.text;
                    
                    // Update the message in real-time
                    setMessages(prev => prev.map(m => 
                      m.id === assistantMessageId 
                        ? { ...m, content: fullContent }
                        : m
                    ));
                  }
                  if (parsed.error) {
                    throw new Error(parsed.error);
                  }
                } catch (e) {
                  // Ignore parse errors for incomplete chunks
                }
              }
            }
          }
        }
        
        // Final update with complete content and citations
        const finalMessage = { 
          ...assistantMessage, 
          content: fullContent,
          citations: streamCitations.length > 0 ? streamCitations : undefined,
        };
        const finalMessages = [...updatedMessages, finalMessage];
        setMessages(finalMessages);
        saveSession(finalMessages);
        
      } else {
        // Handle non-streaming response (Regelverksassistent)
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
        saveSession(finalMessages);
      }
      
    } catch (error) {
      console.error('Chat error:', error);
      
      // Update the placeholder message with error
      setMessages(prev => prev.map(m => 
        m.id === assistantMessageId 
          ? { ...m, content: 'Kunde inte svara just nu. Försök igen.' }
          : m
      ));
    } finally {
      setIsLoading(false);
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

  const handleModeChange = (newMode: AgentMode) => {
    setMode(newMode);
  };

  // Format time ago
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

  const displayedSessions = showAllSessions ? filteredSessions : filteredSessions.slice(0, 5);

  return (
    <div 
      className="h-[calc(100vh-80px)] flex relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-[#c0a280]/10 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-[#c0a280] rounded-xl m-2 transition-all duration-200">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#c0a280]/20 flex items-center justify-center">
              <Paperclip className="w-8 h-8 text-[#c0a280]" />
            </div>
            <p className="text-lg font-medium text-[#2d2a26]">Släpp filer här</p>
            <p className="text-sm text-gray-500 mt-1">PDF, Word, Excel, CSV, bilder</p>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Security Banner */}
        <div className="flex-shrink-0 bg-emerald-50 border-b border-emerald-100">
          <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-emerald-700 font-medium">
              Säker miljö – All data stannar inom ert AWS-konto och lämnar aldrig EU
            </span>
          </div>
        </div>

        {/* Messages Area - Scrollable */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-4"
        >
          <div className="max-w-3xl mx-auto py-4">
          {messages.length === 0 ? (
            /* Empty State - Compact */
            <div className="flex flex-col items-center justify-center pt-8 pb-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg ${
                mode === 'regelverksassistent'
                  ? 'bg-gradient-to-br from-emerald-500 to-emerald-700'
                  : mode === 'chatgpt'
                  ? 'bg-gradient-to-br from-green-500 to-teal-600'
                  : 'bg-gradient-to-br from-violet-500 to-purple-700'
              }`}>
                {mode === 'regelverksassistent' ? (
                  <BookOpen className="w-7 h-7 text-white" />
                ) : mode === 'chatgpt' ? (
                  <Zap className="w-7 h-7 text-white" />
                ) : (
                  <Sparkles className="w-7 h-7 text-white" />
                )}
              </div>
              
              <h2 className="text-lg font-medium text-[#2d2a26] mb-1">
                {mode === 'regelverksassistent' 
                  ? 'Fråga om regelverk'
                  : mode === 'chatgpt'
                  ? 'ChatGPT via AWS Bedrock'
                  : 'Vad kan jag hjälpa dig med?'
                }
              </h2>
              <p className="text-xs text-gray-400 mb-6 text-center max-w-sm">
                {mode === 'regelverksassistent'
                  ? 'Svar med källhänvisningar från uppladdade dokument'
                  : mode === 'chatgpt'
                  ? 'OpenAI GPT via AWS Bedrock – optimerad för kod och analys'
                  : 'Claude 4.6 via AWS Bedrock – all data stannar inom AWS'
                }
              </p>
              
              <div className="w-full max-w-md space-y-2">
                {EXAMPLE_QUESTIONS[mode].map((question, i) => (
                  <button
                    key={i}
                    onClick={() => handleExampleClick(question)}
                    className="w-full text-left px-4 py-2.5 bg-white border border-gray-200 rounded-xl
                               text-sm text-gray-600 hover:border-[#c0a280] hover:bg-[#c0a280]/5
                               transition-all duration-200 shadow-sm"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="space-y-4">
              {messages.map((message, index) => {
                // Find if this is the last assistant message
                const isLastAssistantMessage = message.role === 'assistant' && 
                  index === messages.length - 1 && 
                  !isLoading;
                
                return (
                  <MessageBubble 
                    key={message.id} 
                    message={message}
                    onRegenerate={handleRegenerate}
                    onFeedback={handleFeedback}
                    isLastAssistantMessage={isLastAssistantMessage}
                  />
                );
              })}
              
              {isLoading && <LoadingIndicator mode={mode} />}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Input Area */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-gray-50/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {/* Mode Toggle + Clear */}
          <div className="flex items-center justify-between mb-3">
            <ModeToggle mode={mode} onChange={handleModeChange} />
            
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 
                           hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Rensa
              </button>
            )}
          </div>
          
          {/* Attached Files Preview */}
          {attachedFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachedFiles.map((file, index) => (
                <div 
                  key={index}
                  className={`flex items-center gap-2 bg-white border border-gray-200 rounded-lg text-xs overflow-hidden
                    ${file.preview ? 'p-1' : 'px-3 py-1.5'}`}
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
                      <span className="text-gray-700 max-w-[150px] truncate">{file.name}</span>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Input Box with Pulsating Glow */}
          <div className="relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#c0a280]/30 via-[#c0a280]/40 to-[#c0a280]/30 
                            rounded-2xl blur-md animate-pulse opacity-50" />
            
            <div className="relative bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.xlsx,.xls,.txt,.csv,.png,.jpg,.jpeg,.webp"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <textarea
                ref={inputRef}
                value={isListening ? input + (interimTranscript ? ` ${interimTranscript}` : '') : input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={isListening 
                  ? '🎤 Lyssnar... Prata nu!'
                  : mode === 'regelverksassistent' 
                    ? 'Ställ en fråga om regelverk...'
                    : 'Skriv eller prata... 🎤'
                }
                rows={1}
                className={`w-full px-4 py-3 pl-12 pr-24 text-sm text-[#2d2a26] placeholder-gray-400 
                           resize-none focus:outline-none bg-transparent transition-all
                           ${isListening ? 'bg-red-50/50' : ''}`}
                style={{ minHeight: '48px', maxHeight: '150px' }}
                readOnly={isListening}
              />
              
              {/* Attachment button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFile || isLoading}
                className="absolute left-2 bottom-2 w-9 h-9 rounded-xl text-gray-400
                           hover:text-[#c0a280] hover:bg-gray-100 disabled:opacity-40 
                           disabled:cursor-not-allowed transition-all flex items-center justify-center"
                title="Bifoga fil (PDF, Word, Excel)"
              >
                {isProcessingFile ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Paperclip className="w-4 h-4" />
                )}
              </button>
              
              {/* Voice input button */}
              {isVoiceSupported && (
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isLoading}
                  className={`absolute right-14 bottom-2 w-9 h-9 rounded-xl transition-all flex items-center justify-center
                    ${isListening 
                      ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30' 
                      : 'text-gray-400 hover:text-[#c0a280] hover:bg-gray-100'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  title={isListening ? 'Stoppa inspelning' : 'Röstinmatning (svenska)'}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
              
              <button
                onClick={handleSend}
                disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
                className="absolute right-2 bottom-2 w-9 h-9 rounded-xl bg-[#2d2a26] text-white
                           hover:bg-[#3d3a36] disabled:opacity-40 disabled:cursor-not-allowed
                           transition-all flex items-center justify-center shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {voiceError && (
            <p className="text-center text-[10px] text-red-500 mt-2 flex items-center justify-center gap-1">
              <MicOff className="w-3 h-3" />
              {voiceError}
            </p>
          )}
          <p className="text-center text-[10px] text-gray-400 mt-2">
            {isListening 
              ? '🎤 Inspelning pågår... Klicka på mikrofonen igen för att stoppa'
              : mode === 'regelverksassistent' 
                ? 'Ersätter inte juridisk rådgivning'
                : isVoiceSupported
                  ? 'Skriv eller klicka 🎤 för röstinmatning • All data stannar inom ert AWS-konto'
                  : 'All data stannar inom ert AWS-konto'
            }
          </p>
        </div>
      </div>
      </div>

      {/* Chat History Sidebar */}
      <div className="w-72 border-l border-gray-200 bg-gray-50/50 flex-shrink-0 hidden lg:flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm text-[#2d2a26]">Chatthistorik</h3>
            <button
              onClick={startNewChat}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#c0a280] 
                         hover:bg-[#c0a280]/10 rounded-lg transition-colors"
              title="Ny chatt (⌘K)"
            >
              <Plus className="w-3.5 h-3.5" />
              Ny chatt
            </button>
          </div>
          
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Sök i chattar..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg
                       focus:outline-none focus:border-[#c0a280] focus:ring-1 focus:ring-[#c0a280]/20
                       placeholder:text-gray-400"
            />
            {historySearch && (
              <button
                onClick={() => setHistorySearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        
        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoadingSessions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : displayedSessions.length === 0 ? (
            <div className="text-center py-8 px-4">
              <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Inga tidigare chattar</p>
              <p className="text-[10px] text-gray-300 mt-1">Dina konversationer sparas här</p>
            </div>
          ) : (
            <div className="space-y-1">
              {displayedSessions.map((session) => (
                <button
                  key={session.sessionId}
                  onClick={() => loadSession(session.sessionId)}
                  className={`w-full text-left p-3 rounded-lg transition-all group relative ${
                    currentSessionId === session.sessionId
                      ? 'bg-[#c0a280]/15 border border-[#c0a280]/30'
                      : 'hover:bg-white hover:shadow-sm border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      session.mode === 'regelverksassistent'
                        ? 'bg-emerald-100 text-emerald-600'
                        : session.mode === 'chatgpt'
                        ? 'bg-green-100 text-green-600'
                        : 'bg-violet-100 text-violet-600'
                    }`}>
                      {session.mode === 'regelverksassistent' ? (
                        <BookOpen className="w-3 h-3" />
                      ) : session.mode === 'chatgpt' ? (
                        <Zap className="w-3 h-3" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#2d2a26] truncate">
                        {session.title}
                      </p>
                      <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTimeAgo(session.updatedAt)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Delete button on hover */}
                  <button
                    onClick={(e) => deleteSession(session.sessionId, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg
                               text-gray-300 hover:text-red-500 hover:bg-red-50
                               opacity-0 group-hover:opacity-100 transition-all"
                    title="Ta bort"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </button>
              ))}
            </div>
          )}
          
          {/* Show more button */}
          {filteredSessions.length > 5 && (
            <button
              onClick={() => setShowAllSessions(!showAllSessions)}
              className="w-full mt-2 py-2 text-xs text-[#c0a280] hover:bg-[#c0a280]/10 
                         rounded-lg transition-colors flex items-center justify-center gap-1"
            >
              {showAllSessions ? 'Visa färre' : `Visa ${filteredSessions.length - 5} fler`}
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showAllSessions ? 'rotate-90' : ''}`} />
            </button>
          )}
        </div>
        
        {/* Footer info */}
        <div className="p-3 border-t border-gray-200 bg-gray-100/50">
          <p className="text-[10px] text-gray-400 text-center mb-2">
            Chattar sparas säkert i ditt konto
          </p>
          {/* Keyboard shortcuts hint */}
          <div className="flex items-center justify-center gap-3 text-[9px] text-gray-400">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-200 rounded text-[8px] font-mono">⌘K</kbd>
              Ny chatt
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-200 rounded text-[8px] font-mono">⌘↵</kbd>
              Skicka
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
