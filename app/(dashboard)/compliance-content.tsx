'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
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
// Companies from main data source
// ============================================================================

import { mockCompanies } from '@/lib/companyData';

// Map to compliance company format with "Alla bolag" option
const MOCK_COMPANIES: Company[] = [
  { id: 'all', name: 'Alla bolag', shortName: 'Alla' },
  ...mockCompanies.map(c => ({
    id: c.id,
    name: c.name,
    shortName: c.shortName,
    orgNumber: c.orgNumber,
  })),
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
// Sub-navigation - all links stay on same fullscreen page
// ============================================================================

const NAV_ITEMS = [
  { id: 'chat', label: 'Regelverksassistent', href: '/?view=compliance', icon: Scale },
  { id: 'archive', label: 'Regelverksarkiv', href: '/?view=compliance&tab=archive', icon: BookOpen },
  { id: 'documents', label: 'Dokument', href: '/?view=compliance&tab=documents', icon: FileText },
  { id: 'settings', label: 'Inställningar', href: '/?view=compliance&tab=settings', icon: Settings },
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
// Archive Content
// ============================================================================

function ArchiveContent() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-[#c0a280]/10 flex items-center justify-center mx-auto mb-6">
          <BookOpen className="w-8 h-8 text-[#c0a280]" />
        </div>
        <h2 className="text-xl font-semibold text-[#2d2a26] mb-2">Regelverksarkiv</h2>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Här hittar du alla regelverk, föreskrifter och riktlinjer som är relevanta för din verksamhet.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {[
            { title: 'AIFMD', desc: 'Alternative Investment Fund Managers Directive' },
            { title: 'FFFS 2013:10', desc: 'Förvaltare av alternativa investeringsfonder' },
            { title: 'SFDR', desc: 'Sustainable Finance Disclosure Regulation' },
            { title: 'MiFID II', desc: 'Markets in Financial Instruments Directive' },
            { title: 'GDPR', desc: 'General Data Protection Regulation' },
            { title: 'AML/KYC', desc: 'Anti-Money Laundering & Know Your Customer' },
          ].map((item) => (
            <div key={item.title} className="p-4 bg-gray-50 rounded-xl text-left hover:bg-[#c0a280]/5 hover:border-[#c0a280] border border-transparent transition-all cursor-pointer">
              <h3 className="font-medium text-[#2d2a26]">{item.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Documents Content
// ============================================================================

function DocumentsContent() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-[#c0a280]/10 flex items-center justify-center mx-auto mb-6">
          <FileText className="w-8 h-8 text-[#c0a280]" />
        </div>
        <h2 className="text-xl font-semibold text-[#2d2a26] mb-2">Compliance-dokument</h2>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Hantera dina compliance-dokument, policyer och rutiner.
        </p>
        <div className="space-y-3 max-w-2xl mx-auto">
          {[
            { name: 'Riskpolicy.pdf', date: '2024-01-15', size: '2.4 MB' },
            { name: 'Compliance-manual.pdf', date: '2024-01-10', size: '5.1 MB' },
            { name: 'AML-rutiner.pdf', date: '2024-01-08', size: '1.8 MB' },
            { name: 'Intressekonflikter.pdf', date: '2024-01-05', size: '890 KB' },
          ].map((doc) => (
            <div key={doc.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-[#c0a280]/5 transition-all cursor-pointer">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-400" />
                <div className="text-left">
                  <p className="font-medium text-[#2d2a26]">{doc.name}</p>
                  <p className="text-xs text-gray-400">{doc.date} • {doc.size}</p>
                </div>
              </div>
              <button className="text-sm text-[#c0a280] hover:underline">Öppna</button>
            </div>
          ))}
        </div>
        <button className="mt-6 px-6 py-3 bg-[#2d2a26] text-white rounded-xl text-sm font-medium hover:bg-[#3d3a36] transition-colors">
          Ladda upp dokument
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Settings Content
// ============================================================================

function SettingsContent() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold text-[#2d2a26] mb-6">Inställningar</h2>
        
        <div className="space-y-6">
          <div className="p-4 bg-gray-50 rounded-xl">
            <h3 className="font-medium text-[#2d2a26] mb-2">Notifieringar</h3>
            <p className="text-sm text-gray-500 mb-4">Välj vilka händelser du vill bli notifierad om.</p>
            <div className="space-y-3">
              {['Nya regelverk', 'Uppdateringar av befintliga regelverk', 'Deadlines för rapportering'].map((item) => (
                <label key={item} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-[#c0a280] focus:ring-[#c0a280]" />
                  <span className="text-sm text-gray-700">{item}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl">
            <h3 className="font-medium text-[#2d2a26] mb-2">Kunskapsbas</h3>
            <p className="text-sm text-gray-500 mb-4">Status för din compliance-kunskapsbas.</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">Dokument indexerade</p>
                <p className="text-2xl font-semibold text-[#2d2a26]">847</p>
              </div>
              <button className="px-4 py-2 text-sm text-[#c0a280] border border-[#c0a280] rounded-lg hover:bg-[#c0a280]/10 transition-colors">
                Uppdatera index
              </button>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl">
            <h3 className="font-medium text-[#2d2a26] mb-2">API-integration</h3>
            <p className="text-sm text-gray-500 mb-4">Anslut externa system för automatisk uppdatering.</p>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Ansluten till Finansinspektionens regelverk-API</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface ComplianceContentProps {
  activeTab?: string;
  initialCompanyId?: string; // Allow pre-selecting a company from URL
}

export default function ComplianceContent({ activeTab = 'chat', initialCompanyId }: ComplianceContentProps) {
  // Find initial company if provided
  const getInitialCompany = (): Company => {
    if (initialCompanyId) {
      const found = MOCK_COMPANIES.find(c => c.id === initialCompanyId);
      if (found) return found;
    }
    return MOCK_COMPANIES[0]; // Default to "Alla bolag"
  };

  const [selectedCompany, setSelectedCompany] = useState<Company>(getInitialCompany);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Update selected company if initialCompanyId changes
  useEffect(() => {
    if (initialCompanyId) {
      const found = MOCK_COMPANIES.find(c => c.id === initialCompanyId);
      if (found) setSelectedCompany(found);
    }
  }, [initialCompanyId]);

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

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'archive':
        return <ArchiveContent />;
      case 'documents':
        return <DocumentsContent />;
      case 'settings':
        return <SettingsContent />;
      default:
        return renderChatContent();
    }
  };

  const renderChatContent = () => (
    <>
      {/* Header with company selector */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[#2d2a26]">Regelverksassistent</h1>
            <p className="text-sm text-gray-400 mt-1">AIFMD, FFFS, SFDR och andra regelverk</p>
          </div>
          <CompanySelector
            companies={MOCK_COMPANIES}
            selected={selectedCompany}
            onSelect={setSelectedCompany}
          />
        </div>
      </div>

      {/* Chat Area */}
      <div className="bg-white border border-gray-200 rounded-2xl flex flex-col min-h-[500px]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12">
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
                    className="w-full text-left px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl
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
        <div className="p-4 sm:p-6 border-t border-gray-100">
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ställ en fråga om regelverk..."
              rows={1}
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm 
                         text-[#2d2a26] placeholder-gray-400 resize-none
                         focus:outline-none focus:border-[#c0a280] focus:ring-2 focus:ring-[#c0a280]/10 transition-all"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-5 py-3 bg-[#2d2a26] text-white rounded-xl
                         hover:bg-[#3d3a36] disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline text-sm font-medium">Skicka</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col">
      {/* Sub-navigation */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeTab || (item.id === 'chat' && activeTab === 'chat');
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                isActive 
                  ? 'bg-[#c0a280]/10 text-[#c0a280] font-medium' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Content based on active tab */}
      {renderContent()}
    </div>
  );
}
