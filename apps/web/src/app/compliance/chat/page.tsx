'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Send, Bot, User, FileText, Sparkles, Clock,
  ThumbsUp, ThumbsDown, Copy, CheckCircle2
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

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
      content: `Hej! 👋 Jag är din Compliance Agent.

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

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-140px)]">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-aifm-gold to-aifm-gold/70 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-medium text-aifm-charcoal uppercase tracking-wider">
                Compliance Agent
              </h1>
              <p className="text-sm text-aifm-charcoal/50">
                AI-assistent för dokumentsökning och compliance-frågor
              </p>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((message) => (
              <div 
                key={message.id}
                className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center
                  ${message.role === 'assistant' 
                    ? 'bg-gradient-to-br from-aifm-gold to-aifm-gold/70' 
                    : 'bg-aifm-charcoal'
                  }`}
                >
                  {message.role === 'assistant' 
                    ? <Bot className="w-5 h-5 text-white" />
                    : <User className="w-5 h-5 text-white" />
                  }
                </div>

                {/* Message Content */}
                <div className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                  <div className={`rounded-2xl px-5 py-4 ${
                    message.role === 'assistant' 
                      ? 'bg-gray-50 text-aifm-charcoal' 
                      : 'bg-aifm-charcoal text-white'
                  }`}>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                      {message.content.split('\n').map((line, i) => {
                        if (line.startsWith('**') && line.endsWith('**')) {
                          return <p key={i} className="font-semibold mt-3 first:mt-0">{line.replace(/\*\*/g, '')}</p>;
                        }
                        if (line.startsWith('- ')) {
                          return <p key={i} className="ml-4">• {line.substring(2)}</p>;
                        }
                        if (line.match(/^\d+\./)) {
                          return <p key={i} className="ml-4">{line}</p>;
                        }
                        return <p key={i} className={line ? '' : 'h-2'}>{line}</p>;
                      })}
                    </div>
                  </div>

                  {/* Sources */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.sources.map((source, i) => (
                        <span 
                          key={i}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-aifm-gold/10 text-aifm-gold text-xs rounded-lg"
                        >
                          <FileText className="w-3 h-3" />
                          {source}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions & Timestamp */}
                  <div className={`flex items-center gap-3 mt-2 text-xs text-aifm-charcoal/40
                    ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(message.timestamp)}
                    </span>
                    {message.role === 'assistant' && message.id !== 'welcome' && (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleCopy(message.id, message.content)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Kopiera"
                        >
                          {copiedId === message.id 
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            : <Copy className="w-3.5 h-3.5" />
                          }
                        </button>
                        <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Bra svar">
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Dåligt svar">
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
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-aifm-gold to-aifm-gold/70 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="bg-gray-50 rounded-2xl px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-aifm-gold animate-pulse" />
                    <span className="text-sm text-aifm-charcoal/60">Söker i dokumenten...</span>
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-aifm-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-aifm-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-aifm-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          {messages.length <= 1 && (
            <div className="px-6 py-4 border-t border-gray-100">
              <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-3">Föreslagna frågor</p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((question, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestedQuestion(question)}
                    className="px-4 py-2 bg-gray-50 hover:bg-aifm-gold/10 hover:text-aifm-gold 
                               text-sm text-aifm-charcoal/70 rounded-xl transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ställ en fråga om dina dokument..."
                  rows={1}
                  className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 pr-12
                             focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold
                             text-aifm-charcoal placeholder:text-aifm-charcoal/40"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isTyping}
                className="flex-shrink-0 w-12 h-12 rounded-xl bg-aifm-gold hover:bg-aifm-gold/90 
                           disabled:bg-gray-200 disabled:cursor-not-allowed
                           flex items-center justify-center transition-colors"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
            <p className="text-xs text-aifm-charcoal/40 mt-2 text-center">
              Compliance Agent söker i {5} uppladdade dokument
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

