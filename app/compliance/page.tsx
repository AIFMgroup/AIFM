'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Scale, 
  ChevronDown, 
  Building2, 
  Check, 
  Send, 
  Copy,
  AlertTriangle,
  BookOpen,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  confidence?: number;
  hasRelevantSources?: boolean;
  disclaimer?: string;
  timestamp: string;
}

interface Citation {
  documentTitle: string;
  documentNumber?: string;
  section?: string;
  excerpt: string;
  sourceUrl: string;
  relevanceScore?: number;
}

interface Company {
  id: string;
  name: string;
  shortName?: string;
  orgNumber?: string;
}

// ============================================================================
// Mock companies (replace with API call)
// ============================================================================

const MOCK_COMPANIES: Company[] = [
  { id: 'all', name: 'Alla bolag', shortName: 'Alla' },
  { id: 'company-1', name: 'AIFM Kapital AB', shortName: 'AIFM Kapital', orgNumber: '556789-0123' },
  { id: 'company-2', name: 'Nordic Fund Management', shortName: 'Nordic Fund', orgNumber: '556123-4567' },
  { id: 'company-3', name: 'Swedish Venture Partners', shortName: 'SVP', orgNumber: '556987-6543' },
  { id: 'company-4', name: 'Baltic Investment Group', shortName: 'BIG', orgNumber: '556456-7890' },
];

// ============================================================================
// Example Questions
// ============================================================================

const EXAMPLE_QUESTIONS = [
  'Vilka krav gäller för AIFM Annex IV-rapportering?',
  'Vad säger FFFS 2013:10 om riskhantering?',
  'Vilka PAI-indikatorer är obligatoriska enligt SFDR?',
  'Vad är kapitalkraven för en AIF-förvaltare?',
];

// ============================================================================
// Company Selector Component
// ============================================================================

function CompanySelector({ 
  companies, 
  selected, 
  onSelect 
}: { 
  companies: Company[]; 
  selected: Company; 
  onSelect: (company: Company) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl
                   hover:border-[#c0a280] transition-all min-w-[200px]"
      >
        <Building2 className="w-4 h-4 text-gray-400" />
        <span className="flex-1 text-left text-sm font-medium text-[#2d2a26] truncate">
          {selected.shortName || selected.name}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="py-1 max-h-64 overflow-y-auto">
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => {
                  onSelect(company);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                  selected.id === company.id ? 'bg-[#c0a280]/5' : ''
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  company.id === 'all' ? 'bg-[#c0a280]/10' : 'bg-gray-100'
                }`}>
                  {company.id === 'all' ? (
                    <Scale className="w-4 h-4 text-[#c0a280]" />
                  ) : (
                    <Building2 className="w-4 h-4 text-gray-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#2d2a26] truncate">{company.name}</p>
                  {company.orgNumber && (
                    <p className="text-xs text-gray-400">{company.orgNumber}</p>
                  )}
                </div>
                {selected.id === company.id && (
                  <Check className="w-4 h-4 text-[#c0a280]" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Citation Component
// ============================================================================

function CitationCard({ citation, index }: { citation: Citation; index: number }) {
  return (
    <a 
      href={citation.sourceUrl} 
      target="_blank" 
      rel="noopener noreferrer"
      className="block p-4 bg-[#fafafa] border border-gray-100 rounded-lg hover:border-[#c0a280] transition-colors group"
    >
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-xs font-medium text-[#c0a280]">{index + 1}</span>
        <span className="text-sm font-medium text-[#2d2a26] group-hover:text-[#c0a280] transition-colors">
          {citation.documentTitle}
        </span>
        {citation.documentNumber && (
          <span className="text-xs text-gray-400">{citation.documentNumber}</span>
        )}
      </div>
      {citation.section && (
        <p className="text-xs text-gray-400 mb-2">{citation.section}</p>
      )}
      <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{citation.excerpt}</p>
    </a>
  );
}

// ============================================================================
// Message Component
// ============================================================================

function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const [showAllCitations, setShowAllCitations] = useState(false);
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  if (message.role === 'user') {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[75%] bg-[#2d2a26] text-white rounded-2xl rounded-tr-sm px-5 py-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }
  
  const visibleCitations = showAllCitations 
    ? message.citations 
    : message.citations?.slice(0, 2);
  
  return (
    <div className="max-w-[85%] animate-fade-in">
      {message.hasRelevantSources === false && (
        <div className="mb-3 p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Inga relevanta källor hittades. Verifiera svaret mot andra källor.
          </p>
        </div>
      )}
      
      <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-5 py-4">
        <p className="text-sm text-[#2d2a26] whitespace-pre-wrap leading-relaxed">{message.content}</p>
        
        {message.confidence !== undefined && message.hasRelevantSources && (
          <div className="mt-4 pt-3 border-t border-gray-50">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${message.confidence * 100}%`,
                    backgroundColor: message.confidence >= 0.7 ? '#c0a280' : message.confidence >= 0.4 ? '#e5be8a' : '#f0d4a8'
                  }}
                />
              </div>
              <span className="text-xs text-gray-400">
                {Math.round(message.confidence * 100)}% säkerhet
              </span>
            </div>
          </div>
        )}
        
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-gray-300">
            {new Date(message.timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button 
            onClick={copyToClipboard}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#c0a280] transition-colors"
          >
            <Copy className="w-3 h-3" />
            {copied ? 'Kopierat' : 'Kopiera'}
          </button>
        </div>
      </div>
      
      {message.citations && message.citations.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-gray-400 px-1">Källor ({message.citations.length})</p>
          {visibleCitations?.map((citation, i) => (
            <CitationCard key={i} citation={citation} index={i} />
          ))}
          {message.citations.length > 2 && !showAllCitations && (
            <button
              onClick={() => setShowAllCitations(true)}
              className="w-full py-2 text-xs text-[#c0a280] hover:text-[#2d2a26] transition-colors"
            >
              Visa alla {message.citations.length} källor
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sidebar Navigation
// ============================================================================

function ComplianceSidebar({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void;
}) {
  const navItems = [
    { id: 'chat', label: 'Regelverksassistent', href: '/compliance', icon: Scale, active: true },
    { id: 'archive', label: 'Regelverksarkiv', href: '/compliance/archive', icon: BookOpen },
    { id: 'documents', label: 'Dokument', href: '/compliance/documents', icon: FileText },
    { id: 'settings', label: 'Inställningar', href: '/compliance/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-[#2d2a26] flex flex-col
        transform transition-transform duration-300 lg:transform-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/aifm-logo-white.svg" alt="AIFM" width={80} height={32} className="h-8 w-auto" />
          </Link>
          <button onClick={onClose} className="lg:hidden text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Title */}
        <div className="px-6 pb-4">
          <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Compliance</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                item.active 
                  ? 'bg-white/10 text-white' 
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="p-4 border-t border-white/10">
          <Link
            href="/overview"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Tillbaka till dashboard</span>
          </Link>
        </div>
      </aside>
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function CompliancePage() {
  const [selectedCompany, setSelectedCompany] = useState<Company>(MOCK_COMPANIES[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/compliance/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage.content,
          companyId: selectedCompany.id === 'all' ? undefined : selectedCompany.id,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      
      if (!response.ok) throw new Error('Failed to get response');
      
      const data = await response.json();
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        citations: data.citations,
        confidence: data.confidence,
        hasRelevantSources: data.hasRelevantSources,
        disclaimer: data.disclaimer,
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Kunde inte svara just nu. Försök igen.',
        hasRelevantSources: false,
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
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

  return (
    <div className="min-h-screen bg-[#fafafa] flex">
      {/* Sidebar */}
      <ComplianceSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-[#2d2a26]">Regelverksassistent</h1>
                <p className="text-xs text-gray-400">AIFMD, FFFS, SFDR och andra regelverk</p>
              </div>
            </div>

            {/* Company Selector */}
            <CompanySelector
              companies={MOCK_COMPANIES}
              selected={selectedCompany}
              onSelect={setSelectedCompany}
            />
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-hidden flex flex-col max-w-4xl mx-auto w-full px-4 lg:px-8 py-6">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-[#2d2a26] flex items-center justify-center mb-6">
                  <Scale className="w-8 h-8 text-[#c0a280]" />
                </div>
                <h2 className="text-xl font-medium text-[#2d2a26] mb-2">
                  Vad vill du veta?
                </h2>
                <p className="text-sm text-gray-400 mb-8 max-w-md">
                  Fråga om regelverk för fondförvaltning. Svar kommer med källhänvisningar.
                </p>
                
                {selectedCompany.id !== 'all' && (
                  <p className="text-xs text-[#c0a280] mb-6 px-3 py-1.5 bg-[#c0a280]/10 rounded-full">
                    Söker i kontext av {selectedCompany.shortName || selectedCompany.name}
                  </p>
                )}
                
                <div className="w-full max-w-lg space-y-2">
                  {EXAMPLE_QUESTIONS.map((question, i) => (
                    <button
                      key={i}
                      onClick={() => handleExampleClick(question)}
                      className="w-full text-left px-4 py-3 bg-white border border-gray-100 rounded-xl
                                 text-sm text-gray-600 hover:border-[#c0a280] hover:text-[#2d2a26]
                                 transition-all duration-200"
                    >
                      {question}
                    </button>
                  ))}
                </div>
                
                <p className="mt-8 text-xs text-gray-300 max-w-sm">
                  Svar baseras på inlagda regelverk och ersätter inte juridisk rådgivning.
                </p>
              </div>
            ) : (
              <div className="space-y-6 pb-4">
                {messages.map(message => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                
                {isLoading && (
                  <div className="max-w-[85%] animate-fade-in">
                    <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-[#c0a280] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-[#c0a280] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-[#c0a280] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm text-gray-400">Söker i regelverk...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          
          {/* Input Area */}
          <div className="pt-4 border-t border-gray-100 mt-auto">
            <div className="flex gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ställ en fråga om regelverk..."
                rows={1}
                className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm 
                           text-[#2d2a26] placeholder-gray-400 resize-none
                           focus:outline-none focus:border-[#c0a280] focus:ring-2 focus:ring-[#c0a280]/10 transition-all"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="px-5 py-3 bg-[#2d2a26] text-white rounded-xl
                           hover:bg-[#3d3a36] disabled:opacity-40 disabled:cursor-not-allowed
                           transition-all flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-medium">Skicka</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
