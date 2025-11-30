'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { 
  X, Send, Sparkles, Maximize2, Minimize2,
  HelpCircle, BookOpen, Settings, BarChart3, Users, Calculator
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
}

// Knowledge base for the assistant
const knowledgeBase = {
  overview: {
    keywords: ['översikt', 'dashboard', 'startsida', 'hem'],
    answer: 'På **Översiktssidan** ser du dina viktigaste nyckeltal: Nettotillgångsvärde (NAV), MOIC, IRR och orealiserad vinst. Du kan expandera sektioner för att se portföljfördelning och KPI:er över tid. Klicka på "Nytt kapitalanrop" eller "Ny utdelning" för snabbåtgärder.',
  },
  portfolio: {
    keywords: ['portfölj', 'bolag', 'investering', 'lägg till bolag'],
    answer: 'I **Portföljen** hanterar du alla dina portföljbolag. Använd tabbarna för att växla mellan Bolag, Sektorer och Statistik. Klicka på "+ Lägg till" för att registrera en ny investering - välj sektor och land genom att klicka på pills, fyll i investeringsbelopp och ägarandel.',
  },
  investors: {
    keywords: ['investerare', 'lp', 'limited partner', 'kyc'],
    answer: 'På **Investerare-sidan** ser du alla LP:s med deras KYC-status. Filtrera på status (Godkända, Väntande, Förfallna) med tabbarna. Klicka på en investerare för att se detaljer, commitments och compliance-status.',
  },
  capitalCalls: {
    keywords: ['kapitalanrop', 'capital call', 'anrop', 'inbetalning'],
    answer: 'Under **Kapitalanrop** hanterar du alla kapitalanrop. Använd tabbarna Aktiva/Historik/Statistik. Klicka på "+ Nytt anrop" för att skapa ett kapitalanrop - välj typ, förfallodatum och se fördelningen automatiskt baserat på commitments.',
  },
  distributions: {
    keywords: ['utdelning', 'distribution', 'utbetalning'],
    answer: 'På **Utdelningar** ser du väntande och genomförda utdelningar. Alla utdelningar kräver 4-ögon-godkännande (två personer måste godkänna). Klicka på "+ Ny utdelning" och välj typ (vinst/kapital/ränta).',
  },
  accounting: {
    keywords: ['bokföring', 'accounting', 'faktura', 'kvitto', 'transaktion'],
    answer: 'I **Bokföringen** följer du hela kedjan: 1) Ladda upp underlag - AI klassificerar automatiskt, 2) Löpande bokföring - granska och godkänn transaktioner, 3) Bokslut - stäng perioder, 4) Årsredovisning, 5) Betalningar. Progress visas med den cirkulära indikatorn.',
  },
  dataRooms: {
    keywords: ['datarum', 'dokument', 'fil', 'dela'],
    answer: 'I **Datarum** skapar du säkra rum för dokumentdelning med investerare eller andra parter. Klicka på "+ Nytt datarum", välj typ och säkerhetsnivå. Du kan bjuda in medlemmar med olika behörigheter (visa/ladda ner/redigera).',
  },
  compliance: {
    keywords: ['compliance', 'regelefterlevnad', 'agent', 'ai'],
    answer: '**Compliance Agent** är din AI-assistent för regelefterlevnad. Ladda upp dokument under "Ladda upp dokument" för analys. Använd chatten för att ställa frågor om AIFMD, AML, KYC eller andra regler - AI:n söker i dina dokument och ger källhänvisningar.',
  },
  tasks: {
    keywords: ['uppgift', 'task', 'att göra', 'todo'],
    answer: 'På **Uppgifter** samlas alla dina att-göra från olika områden (compliance, bokföring, godkännanden). Filtrera på status eller kategori. Klicka på en uppgift för detaljer och markera som klar när du är färdig.',
  },
  approvals: {
    keywords: ['godkännande', 'approval', '4-ögon', 'signera'],
    answer: '**Godkännanden** visar alla poster som väntar på ditt godkännande. AIFM använder 4-ögon-principen - två personer måste godkänna känsliga transaktioner. Du ser vem som redan godkänt och kan lägga till kommentarer.',
  },
  settings: {
    keywords: ['inställning', 'setting', 'konto', 'integration'],
    answer: 'I **Inställningar** hanterar du: Fonduppgifter, Säkerhet (2FA), Bankintegrationer (SEB, Nordea etc), Bolagsuppgifter, Rapportering, och Integrationer (Fortnox). Du kan också hantera teammedlemmar och deras roller.',
  },
  fundSwitch: {
    keywords: ['byt fond', 'växla', 'annan fond', 'bolagsväljare'],
    answer: 'För att **byta fond**: Klicka på bolagsväljaren i headern (visar nuvarande fond). Sök eller klicka på en annan fond i listan. All data uppdateras automatiskt. Du kan lägga till nya fonder via "+ Nytt bolag".',
  },
  export: {
    keywords: ['export', 'ladda ner', 'excel', 'pdf', 'csv'],
    answer: 'Du kan **exportera data** från de flesta sidor via "Exportera"-knappen. Välj format: Excel (för analys), CSV (för import till andra system), eller PDF (för utskrift). Exporten inkluderar all synlig data med filter.',
  },
};

function findAnswer(query: string): { answer: string; sources: string[] } {
  const lowerQuery = query.toLowerCase();
  const sources: string[] = [];
  
  // Check each knowledge area
  for (const [area, data] of Object.entries(knowledgeBase)) {
    if (data.keywords.some(kw => lowerQuery.includes(kw))) {
      sources.push(area);
      return { answer: data.answer, sources };
    }
  }
  
  // Default response
  return {
    answer: 'Jag hjälper dig gärna! Du kan fråga mig om:\n\n• **Portfölj** - hantera bolag och investeringar\n• **Kapitalanrop & Utdelningar** - skapa och hantera\n• **Bokföring** - ladda upp underlag, transaktioner\n• **Datarum** - dokumentdelning\n• **Compliance** - regelefterlevnad\n• **Inställningar** - integrationer och team\n\nVad vill du veta mer om?',
    sources: ['hjälp']
  };
}

// Quick suggestion pills
const quickSuggestions = [
  { icon: BarChart3, label: 'Hur skapar jag kapitalanrop?', query: 'kapitalanrop' },
  { icon: Users, label: 'Hur lägger jag till bolag?', query: 'lägg till bolag' },
  { icon: Calculator, label: 'Hur fungerar bokföringen?', query: 'bokföring' },
  { icon: HelpCircle, label: 'Hur byter jag fond?', query: 'byt fond' },
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = (query?: string) => {
    const messageText = query || input.trim();
    if (!messageText) return;

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const { answer, sources } = findAnswer(messageText);
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: answer,
        timestamp: new Date(),
        sources,
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 800);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat Button - Bottom Right */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 group"
        >
          {/* Pulsing ring effect */}
          <div className="absolute inset-0 bg-aifm-gold/30 rounded-full animate-ping" />
          <div className="absolute inset-0 bg-aifm-gold/20 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
          
          {/* Main button */}
          <div className="relative w-16 h-16 bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90 rounded-full 
                          shadow-2xl shadow-aifm-charcoal/30 flex items-center justify-center
                          group-hover:scale-110 group-hover:shadow-aifm-gold/20 transition-all duration-300
                          border-2 border-white/10">
            <Image
              src="/maskot6.png"
              alt="AIFM Assistant"
              width={40}
              height={40}
              className="rounded-full object-cover"
            />
          </div>
          
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="bg-aifm-charcoal text-white text-sm px-4 py-2 rounded-xl shadow-xl whitespace-nowrap">
              Behöver du hjälp?
              <div className="absolute top-full right-6 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-aifm-charcoal" />
            </div>
          </div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div 
          className={`fixed z-50 bg-white shadow-2xl shadow-black/20 flex flex-col transition-all duration-300 ${
            isExpanded 
              ? 'inset-4 sm:inset-8 rounded-2xl' 
              : 'bottom-6 right-6 w-[380px] sm:w-[420px] h-[600px] max-h-[80vh] rounded-2xl'
          }`}
        >
          {/* Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-aifm-charcoal to-aifm-charcoal/90 rounded-t-2xl flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Image
                  src="/maskot6.png"
                  alt="AIFM Assistant"
                  width={44}
                  height={44}
                  className="rounded-full border-2 border-white/20"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-aifm-charcoal animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold text-white">AIFM Assistent</h3>
                <p className="text-xs text-white/50 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Online - Redo att hjälpa
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Welcome message if no messages */}
            {messages.length === 0 && (
              <div className="text-center py-8">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-aifm-gold/20 to-aifm-charcoal/10 rounded-full flex items-center justify-center">
                  <Image
                    src="/maskot6.png"
                    alt="AIFM Assistant"
                    width={56}
                    height={56}
                    className="rounded-full"
                  />
                </div>
                <h4 className="font-semibold text-aifm-charcoal mb-2">Hej! Jag är din AIFM-assistent 👋</h4>
                <p className="text-sm text-aifm-charcoal/60 mb-6">
                  Jag kan hjälpa dig med allt i plattformen.<br />
                  Ställ en fråga eller välj nedan:
                </p>
                
                {/* Quick Suggestions */}
                <div className="space-y-2">
                  {quickSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.query}
                      onClick={() => handleSend(suggestion.label)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-aifm-gold/5 
                                 rounded-xl text-left transition-colors group"
                    >
                      <div className="p-2 bg-white rounded-lg shadow-sm group-hover:bg-aifm-gold/10 transition-colors">
                        <suggestion.icon className="w-4 h-4 text-aifm-charcoal/50 group-hover:text-aifm-gold transition-colors" />
                      </div>
                      <span className="text-sm text-aifm-charcoal/70 group-hover:text-aifm-charcoal transition-colors">
                        {suggestion.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <Image
                        src="/maskot6.png"
                        alt="AIFM"
                        width={24}
                        height={24}
                        className="rounded-full"
                      />
                      <span className="text-xs text-aifm-charcoal/40">AIFM Assistent</span>
                    </div>
                  )}
                  <div
                    className={`px-4 py-3 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-aifm-charcoal text-white rounded-br-md'
                        : 'bg-gray-100 text-aifm-charcoal rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed"
                       dangerouslySetInnerHTML={{ 
                         __html: message.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
                       }}
                    />
                  </div>
                  {message.sources && message.sources.length > 0 && message.role === 'assistant' && (
                    <div className="flex items-center gap-1 mt-2 ml-1">
                      <BookOpen className="w-3 h-3 text-aifm-charcoal/30" />
                      <span className="text-[10px] text-aifm-charcoal/30">
                        Källa: {message.sources.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-aifm-charcoal/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-aifm-charcoal/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-aifm-charcoal/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-gray-100 flex-shrink-0 bg-gray-50/50 rounded-b-2xl">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ställ en fråga..."
                className="flex-1 py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm
                           focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10
                           placeholder:text-aifm-charcoal/30 transition-all"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="p-3 bg-aifm-charcoal text-white rounded-xl hover:bg-aifm-charcoal/90 
                           disabled:opacity-50 disabled:cursor-not-allowed transition-all
                           shadow-lg shadow-aifm-charcoal/20"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[10px] text-aifm-charcoal/30 text-center mt-2">
              Tryck Enter för att skicka • AI-assisterad hjälp
            </p>
          </div>
        </div>
      )}
    </>
  );
}

