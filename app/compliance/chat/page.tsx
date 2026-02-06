'use client';

// Force dynamic rendering to avoid SSR issues
export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect } from 'react';
import { 
  Send, User, FileText, Sparkles,
  ThumbsUp, ThumbsDown, Copy, CheckCircle2, MessageCircle
} from 'lucide-react';

import Image from 'next/image';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
  isTyping?: boolean;
}

// Predefined responses based on keywords
const mockResponses: { keywords: string[]; response: string; sources: string[] }[] = [
  {
    keywords: ['nav', 'nettotillgångsvärde', 'värde'],
    response: `Baserat på de uppladdade dokumenten kan jag ge dig följande information om NAV (Nettotillgångsvärde):

**Aktuellt NAV för Nordic Ventures I:**
- NAV per 2024-11-30: **128,5 MSEK**
- NAV per andel: **1 285 SEK**
- Förändring sedan årsskiftet: **+12,4%**

**Beräkningsmetod:**
NAV beräknas enligt fondbestämmelserna genom att summera marknadsvärdet av samtliga tillgångar minus skulder, dividerat med antal utestående andelar.

**Värderingsfrekvens:**
Enligt årsredovisningen värderas portföljbolagen kvartalsvis med extern värdering årligen.`,
    sources: ['Årsredovisning_2023.pdf', 'Fondbestämmelser_v2.pdf', 'Kvartalsbokslut_Q3_2024.pdf']
  },
  {
    keywords: ['avgift', 'förvaltningsavgift', 'kostnad', 'fee'],
    response: `Enligt fondbestämmelserna finns följande avgiftsstruktur:

**Förvaltningsavgift:**
- Årlig förvaltningsavgift: **2,0%** av förvaltat kapital
- Beräknas på committed capital under investeringsperioden
- Beräknas på investerat kapital efter investeringsperioden

**Carried Interest:**
- **20%** av vinst över hurdle rate
- Hurdle rate: **8%** årlig avkastning
- Catch-up: 100% till GP tills 20/80 fördelning uppnåtts

**Övriga avgifter:**
- Transaktionskostnader: Belastar fonden direkt
- Revisionsarvode: Ca 150 000 SEK/år
- Juridiska kostnader: Belastar fonden vid transaktioner`,
    sources: ['Fondbestämmelser_v2.pdf', 'Årsredovisning_2023.pdf']
  },
  {
    keywords: ['investering', 'portfölj', 'bolag', 'innehav'],
    response: `Baserat på tillgänglig dokumentation har jag sammanställt portföljöversikten:

**Portföljfördelning per sektor:**
- SaaS: **35%** (45 MSEK)
- DeepTech: **25%** (32 MSEK)
- AI: **20%** (26 MSEK)
- FinTech: **20%** (25,5 MSEK)

**Antal portföljbolag:** 12 aktiva investeringar

**Investeringsstrategi:**
Enligt fondbestämmelserna fokuserar fonden på tidiga tillväxtbolag inom tech-sektorn i Norden med följande kriterier:
- Investeringsstorlek: 5-20 MSEK per bolag
- Målbolag: Series A till Series B
- Geografiskt fokus: Sverige, Norge, Finland, Danmark

**Senaste investeringen:**
NyVenture AB - Såddfinansiering om 12,5 MEUR (nov 2024)`,
    sources: ['Årsredovisning_2023.pdf', 'Due_Diligence_TechCorp.xlsx', 'Kvartalsbokslut_Q3_2024.pdf']
  },
  {
    keywords: ['risk', 'compliance', 'regelefterlevnad', 'tillsyn'],
    response: `Enligt dokumentationen finns följande compliance-relaterad information:

**Tillsynsmyndighet:**
Fonden står under Finansinspektionens tillsyn som registrerad AIF-förvaltare.

**Riskhantering:**
- Kvartalsvis riskrapportering till styrelsen
- Årlig oberoende granskning av riskhanteringsprocesser
- Löpande övervakning av exponeringar och limiter

**Compliance-krav:**
- AIFMD-rapportering (Annex IV) kvartalsvis
- Årlig årsredovisning enligt ÅRKL
- Kvartalsvis NAV-rapportering till investerare
- AML/KYC-kontroller vid nyinvestering

**Senaste compliance-granskning:**
Genomförd Q3 2024 utan anmärkningar.`,
    sources: ['Årsredovisning_2023.pdf', 'Fondbestämmelser_v2.pdf']
  },
  {
    keywords: ['utdelning', 'distribution', 'återbetalning'],
    response: `Information om utdelningar och distributioner:

**Utdelningspolicy:**
Enligt fondbestämmelserna sker utdelning till investerare när:
- Fondens likviditet överstiger rörelsekapitalbehovet
- Exit eller delförsäljning av portföljbolag genomförts
- Styrelsen beslutat om distribution

**Historiska utdelningar:**
- 2024 YTD: **45 MSEK** (varav Q3: 25 MSEK)
- 2023: **32 MSEK**
- 2022: **18 MSEK**

**Utdelningsförfarande:**
1. Styrelsen beslutar om distribution
2. GP Admin förbereder utdelningsavisering
3. Belopp fördelas pro rata baserat på kapitalkonton
4. Utbetalning inom 10 bankdagar

**Nästa planerade utdelning:**
Preliminärt Q1 2025 efter årsbokslut.`,
    sources: ['Fondbestämmelser_v2.pdf', 'Kvartalsbokslut_Q3_2024.pdf']
  },
];

const suggestedQuestions = [
  'Vad är fondens aktuella NAV?',
  'Vilka avgifter tar fonden ut?',
  'Hur ser portföljfördelningen ut?',
  'Vilka compliance-krav gäller?',
  'När sker nästa utdelning?',
];

export default function ComplianceAgentPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hej! Jag är din Compliance Agent.

Jag har tillgång till alla uppladdade dokument och kan hjälpa dig att hitta information om:
- Fondbestämmelser och policyer
- Finansiell information och nyckeltal
- Compliance och regelefterlevnad
- Investeringar och portföljbolag

Ställ gärna en fråga så söker jag igenom dokumenten åt dig!`,
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const findResponse = (query: string): { response: string; sources: string[] } => {
    const lowerQuery = query.toLowerCase();
    
    for (const mockResponse of mockResponses) {
      if (mockResponse.keywords.some(keyword => lowerQuery.includes(keyword))) {
        return { response: mockResponse.response, sources: mockResponse.sources };
      }
    }

    return {
      response: `Tack för din fråga! Jag har sökt igenom de uppladdade dokumenten men kunde inte hitta specifik information om detta.

**Vad jag kan hjälpa dig med:**
- Frågor om fondbestämmelser och avgifter
- NAV och finansiell information
- Portföljbolag och investeringar
- Compliance och regelefterlevnad
- Utdelningar och distributioner

Försök gärna omformulera din fråga eller välj ett av de föreslagna ämnena nedan.`,
      sources: []
    };
  };

  const handleSend = () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response with typing delay
    setTimeout(() => {
      const { response, sources } = findResponse(userMessage.content);
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        sources,
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500 + Math.random() * 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInputValue(question);
    inputRef.current?.focus();
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('sv-SE', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Helper functions for table parsing
  const isTableRow = (line: string): boolean => {
    return line.trim().startsWith('|') && line.trim().endsWith('|');
  };

  const isTableSeparator = (line: string): boolean => {
    return /^\|[\s\-:]+\|/.test(line.trim()) && line.includes('-');
  };

  const parseTableCells = (row: string): string[] => {
    return row
      .split('|')
      .slice(1, -1)
      .map(cell => cell.trim());
  };

  const renderInlineBold = (text: string, isAssistant: boolean) => {
    if (text.includes('**')) {
      const parts = text.split(/\*\*/);
      return parts.map((part, j) => 
        j % 2 === 1 ? <strong key={j} className="font-semibold">{part}</strong> : part
      );
    }
    return text;
  };

  const renderTable = (tableLines: string[], startIndex: number, isAssistant: boolean) => {
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
        <table className={`min-w-full border-collapse text-sm ${isAssistant ? 'text-white' : 'text-aifm-charcoal'}`}>
          {headerRows.length > 0 && (
            <thead>
              {headerRows.map((row, rowIdx) => (
                <tr key={`thead-${rowIdx}`} className={isAssistant ? 'bg-white/10 border-b border-white/20' : 'bg-aifm-cream border-b border-aifm-charcoal/20'}>
                  {row.map((cell, cellIdx) => (
                    <th 
                      key={`th-${rowIdx}-${cellIdx}`}
                      className={`px-3 py-2 text-left font-semibold border ${isAssistant ? 'border-white/20' : 'border-aifm-charcoal/20'}`}
                    >
                      {renderInlineBold(cell, isAssistant)}
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
                className={isAssistant 
                  ? (rowIdx % 2 === 0 ? 'bg-white/5' : 'bg-transparent') 
                  : (rowIdx % 2 === 0 ? 'bg-white' : 'bg-aifm-cream/50')
                }
              >
                {row.map((cell, cellIdx) => (
                  <td 
                    key={`td-${rowIdx}-${cellIdx}`}
                    className={`px-3 py-2 border ${isAssistant ? 'border-white/20' : 'border-aifm-charcoal/20'}`}
                  >
                    {renderInlineBold(cell, isAssistant)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Parse message content with markdown-like formatting
  const renderMessageContent = (content: string, isAssistant: boolean) => {
    const lines = content.split('\n');
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
        const table = renderTable(tableLines, tableStartIndex, isAssistant);
        if (table) {
          elements.push(table);
        }
        continue;
      }
      
      // Bold text
      if (line.startsWith('**') && line.endsWith('**')) {
        elements.push(
          <p key={i} className={`font-semibold mt-3 first:mt-0 ${isAssistant ? 'text-white' : 'text-aifm-charcoal'}`}>
            {line.replace(/\*\*/g, '')}
          </p>
        );
      }
      // Inline bold
      else if (line.includes('**')) {
        const parts = line.split(/\*\*/);
        elements.push(
          <p key={i} className={isAssistant ? 'text-white/90' : 'text-aifm-charcoal/90'}>
            {parts.map((part, j) => 
              j % 2 === 1 ? <strong key={j} className="font-semibold">{part}</strong> : part
            )}
          </p>
        );
      }
      // List items
      else if (line.startsWith('- ')) {
        elements.push(
          <p key={i} className={`ml-3 ${isAssistant ? 'text-white/90' : 'text-aifm-charcoal/90'}`}>
            • {line.substring(2)}
          </p>
        );
      }
      // Numbered list
      else if (line.match(/^\d+\./)) {
        elements.push(
          <p key={i} className={`ml-3 ${isAssistant ? 'text-white/90' : 'text-aifm-charcoal/90'}`}>
            {line}
          </p>
        );
      }
      // Empty line
      else if (!line) {
        elements.push(<div key={i} className="h-2" />);
      }
      // Regular text
      else {
        elements.push(
          <p key={i} className={isAssistant ? 'text-white/90' : 'text-aifm-charcoal/90'}>
            {line}
          </p>
        );
      }
      
      i++;
    }
    
    return elements;
  };

  return (
    
      <div className="flex flex-col h-[calc(100vh-140px)]">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/80 
                            flex items-center justify-center shadow-lg shadow-aifm-charcoal/20
                            animate-pulse-slow overflow-hidden">
              <Image
                src="/maskot7.png"
                alt="Compliance Agent"
                width={56}
                height={56}
                className="rounded-xl"
              />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-aifm-charcoal tracking-tight">
                Compliance Agent
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <p className="text-sm text-aifm-charcoal/50">
                  Online • Söker i {5} dokument
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Container - Messenger Style */}
        <div className="flex-1 bg-gradient-to-b from-gray-50 to-gray-100/50 rounded-2xl overflow-hidden flex flex-col
                        border border-gray-200/50 shadow-inner">
          
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div 
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-md overflow-hidden
                  ${message.role === 'assistant' 
                    ? 'bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/80' 
                    : 'bg-gradient-to-br from-aifm-gold to-aifm-gold/80'
                  }`}
                >
                  {message.role === 'assistant' 
                    ? <Image src="/maskot7.png" alt="Agent" width={40} height={40} className="rounded-full" />
                    : <User className="w-5 h-5 text-white" />
                  }
                </div>

                {/* Message Bubble */}
                <div className={`max-w-[75%] ${message.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                  {/* Messenger-style bubble */}
                  <div className={`rounded-2xl px-5 py-4 shadow-sm ${
                    message.role === 'assistant' 
                      ? 'bg-aifm-charcoal text-white rounded-tl-md' 
                      : 'bg-white text-aifm-charcoal rounded-tr-md border border-gray-100'
                  }`}>
                    <div className="text-sm leading-relaxed">
                      {renderMessageContent(message.content, message.role === 'assistant')}
                    </div>
                  </div>

                  {/* Sources (for assistant messages) */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.sources.map((source, i) => (
                        <span 
                          key={i}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 
                                     bg-white text-aifm-charcoal/70 text-xs rounded-full
                                     border border-gray-200 shadow-sm
                                     hover:border-aifm-gold/50 hover:text-aifm-gold transition-colors cursor-pointer"
                        >
                          <FileText className="w-3 h-3" />
                          {source}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Timestamp & Actions */}
                  <div className={`flex items-center gap-3 mt-2 text-xs text-aifm-charcoal/40
                    ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <span>{formatTime(message.timestamp)}</span>
                    {message.role === 'assistant' && message.id !== 'welcome' && (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleCopy(message.id, message.content)}
                          className="p-1.5 hover:bg-white rounded-lg transition-colors"
                          title="Kopiera"
                        >
                          {copiedId === message.id 
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            : <Copy className="w-3.5 h-3.5" />
                          }
                        </button>
                        <button className="p-1.5 hover:bg-white rounded-lg transition-colors" title="Bra svar">
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 hover:bg-white rounded-lg transition-colors" title="Dåligt svar">
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/80 
                                flex items-center justify-center shadow-md overflow-hidden">
                  <Image src="/maskot7.png" alt="Agent" width={40} height={40} className="rounded-full" />
                </div>
                <div className="bg-aifm-charcoal rounded-2xl rounded-tl-md px-5 py-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-aifm-gold animate-pulse" />
                    <span className="text-sm text-white/70">Söker i dokumenten</span>
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-aifm-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-aifm-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-aifm-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          {messages.length <= 1 && (
            <div className="px-6 py-4 bg-white/80 backdrop-blur-sm border-t border-gray-100">
              <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider font-medium mb-3 flex items-center gap-2">
                <MessageCircle className="w-3 h-3" />
                Föreslagna frågor
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((question, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestedQuestion(question)}
                    className="px-4 py-2.5 bg-white hover:bg-aifm-gold/10 
                               text-sm text-aifm-charcoal/70 hover:text-aifm-charcoal
                               rounded-full border border-gray-200 hover:border-aifm-gold/30
                               transition-all duration-300 shadow-sm hover:shadow-md"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area - Messenger Style */}
          <div className="p-4 bg-white border-t border-gray-100">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Skriv din fråga här..."
                  rows={1}
                  className="w-full resize-none rounded-2xl border border-gray-200 
                             bg-gray-50 px-5 py-3.5
                             focus:outline-none focus:ring-2 focus:ring-aifm-charcoal/20 focus:border-aifm-charcoal/30
                             focus:bg-white
                             text-aifm-charcoal placeholder:text-aifm-charcoal/40
                             transition-all duration-200"
                  style={{ minHeight: '52px', maxHeight: '120px' }}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isTyping}
                className="flex-shrink-0 w-12 h-12 rounded-full 
                           bg-aifm-charcoal hover:bg-aifm-charcoal/90 
                           disabled:bg-gray-200 disabled:cursor-not-allowed
                           flex items-center justify-center 
                           transition-all duration-300 
                           shadow-lg shadow-aifm-charcoal/20 hover:shadow-xl hover:shadow-aifm-charcoal/30
                           hover:scale-105 active:scale-95"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
  );
}
