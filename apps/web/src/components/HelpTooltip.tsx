'use client';

import { useState, useRef, useEffect } from 'react';
import { HelpCircle, X, ChevronRight, Lightbulb, BookOpen } from 'lucide-react';

interface HelpTooltipProps {
  title: string;
  description: string;
  steps?: string[];
  tips?: string[];
  learnMoreLink?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
}

export function HelpTooltip({ 
  title, 
  description, 
  steps, 
  tips,
  learnMoreLink,
  position = 'top',
  size = 'sm'
}: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-6 h-6';
  
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="relative inline-flex" ref={tooltipRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${iconSize} text-aifm-charcoal/40 hover:text-aifm-gold transition-colors cursor-help`}
        aria-label="Help"
      >
        <HelpCircle className="w-full h-full" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setIsOpen(false)} />
          
          {/* Tooltip */}
          <div 
            className={`absolute z-50 ${positionClasses[position]} w-72 md:w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200`}
          >
            {/* Header */}
            <div className="bg-aifm-gold/10 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-aifm-gold" />
                <span className="font-medium text-aifm-charcoal text-sm">{title}</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-aifm-gold/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-aifm-charcoal/60" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
              <p className="text-sm text-aifm-charcoal/70">{description}</p>

              {steps && steps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-aifm-charcoal/50 uppercase tracking-wider">Steg för steg</p>
                  <ol className="space-y-2">
                    {steps.map((step, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="w-5 h-5 bg-aifm-gold/20 text-aifm-gold rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                          {index + 1}
                        </span>
                        <span className="text-sm text-aifm-charcoal/70">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {tips && tips.length > 0 && (
                <div className="bg-amber-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-medium text-amber-800 uppercase tracking-wider">Tips</span>
                  </div>
                  <ul className="space-y-1">
                    {tips.map((tip, index) => (
                      <li key={index} className="text-xs text-amber-700 flex items-start gap-1">
                        <span>•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer */}
            {learnMoreLink && (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                <a 
                  href={learnMoreLink}
                  className="flex items-center gap-2 text-sm text-aifm-gold hover:text-aifm-gold/80 transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Läs mer i guiden</span>
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Export common help content for reuse
export const helpContent = {
  // Capital Calls
  capitalCalls: {
    title: 'Kapitalanrop',
    description: 'Kapitalanrop (Capital Calls) används för att kalla in kapital från investerare enligt deras åtaganden. Varje investerare betalar sin andel baserat på deras commitment.',
    steps: [
      'Klicka på "New Capital Call"',
      'Ange totalbelopp att kalla in',
      'Beskriv syftet (t.ex. ny investering)',
      'Granska fördelningen per investerare',
      'Skapa anropet - investerare notifieras automatiskt'
    ],
    tips: [
      'Du kan se status för varje investerares betalning i realtid',
      'Skicka påminnelser till de som inte betalat'
    ]
  },

  // Distributions
  distributions: {
    title: 'Utdelningar',
    description: 'Utdelningar (Distributions) används för att distribuera avkastning till investerare. Alla utdelningar kräver godkännande från två personer (4-ögon principen).',
    steps: [
      'Klicka på "New Distribution"',
      'Välj typ (utdelning, kapitalåterbäring, etc.)',
      'Ange totalbelopp',
      'Systemet beräknar varje investerares andel automatiskt',
      'Skicka för godkännande - en annan person måste godkänna'
    ],
    tips: [
      '4-ögon principen säkerställer att ingen kan göra utbetalningar ensam',
      'All aktivitet loggas för full spårbarhet'
    ]
  },

  // Data Rooms
  dataRooms: {
    title: 'Säkra Datarum',
    description: 'Datarum är krypterade utrymmen där du kan dela känsliga dokument med specifika personer. Varje rum har sin egen åtkomstkontroll.',
    steps: [
      'Skapa ett nytt datarum',
      'Välj typ (Due Diligence, Styrelse, etc.)',
      'Ladda upp dokument',
      'Bjud in medlemmar med specifika behörigheter',
      'Följ aktivitet - se vem som öppnat vilka dokument'
    ],
    tips: [
      'Använd vattenmärkning för extra säkerhet',
      'Sätt utgångsdatum för tidsbegränsad åtkomst'
    ]
  },

  // Treasury
  treasury: {
    title: 'Treasury & Likviditet',
    description: 'Treasury-modulen ger översikt över fondens bankkonton, transaktioner och fakturor. Integreras med banken för automatisk synkronisering.',
    steps: [
      'Se saldo över alla konton i realtid',
      'Granska inkommande transaktioner',
      'Matcha transaktioner mot kapitalanrop/fakturor',
      'Hantera leverantörsfakturor',
      'Initiera betalningar (kräver 4-ögon godkännande)'
    ],
    tips: [
      'Systemet matchar transaktioner automatiskt med AI',
      'Alla stora betalningar kräver dubbelt godkännande'
    ]
  },

  // Approvals
  approvals: {
    title: '4-Ögon Godkännande',
    description: '4-ögon principen (Vier-Augen-Prinzip) innebär att alla finansiella transaktioner kräver godkännande från två separata personer. Detta förhindrar fel och bedrägerier.',
    steps: [
      'Granska väntande godkännanden',
      'Klicka på ett ärende för detaljer',
      'Verifiera informationen',
      'Godkänn eller avslå med motivering',
      'Om du är första godkännare, väntar ärendet på en andra'
    ],
    tips: [
      'Du kan inte godkänna ärenden du själv skapat',
      'Alla godkännanden loggas permanent'
    ]
  },

  // Investors
  investors: {
    title: 'Investerarhantering',
    description: 'Hantera alla investerare (LPs), deras åtaganden, KYC-status och kommunikation på ett ställe.',
    steps: [
      'Se översikt över alla investerare',
      'Klicka på en investerare för detaljer',
      'Granska KYC/AML-status',
      'Se commitment och inbetalningar',
      'Skicka kommunikation direkt från systemet'
    ],
    tips: [
      'KYC-status uppdateras automatiskt',
      'Systemet varnar för investerare som behöver uppmärksamhet'
    ]
  },

  // Portfolio
  portfolio: {
    title: 'Portföljövervakning',
    description: 'Följ upp alla portföljbolags utveckling, värderingar och nyckeltal. Ladda upp rapporter så extraherar AI relevant data automatiskt.',
    steps: [
      'Se översikt över alla portföljbolag',
      'Klicka på ett bolag för detaljer',
      'Ladda upp kvartalsrapporter',
      'AI extraherar nyckeltal automatiskt',
      'Följ värderingsutveckling över tid'
    ],
    tips: [
      'AI kan läsa PDF och Excel och fylla i siffror automatiskt',
      'Du kan justera AI:s förslag innan de sparas'
    ]
  },

  // Fund Dashboard
  fundDashboard: {
    title: 'Fondöversikt',
    description: 'Dashboard som visar fondens status, NAV, avkastning och viktigaste nyckeltal på ett ställe.',
    steps: [
      'Välj fond i dropdown-menyn',
      'Se aktuellt NAV och avkastning',
      'Granska committed vs called kapital',
      'Se portföljbolagsöversikt',
      'Exportera rapporter'
    ],
    tips: [
      'IRR och TVPI beräknas automatiskt',
      'Data uppdateras i realtid'
    ]
  },

  // Clients (Bookkeeping)
  clients: {
    title: 'Bokföringsagent',
    description: 'Ladda upp fakturor och kvitton - AI klassificerar och konterar automatiskt enligt BAS-kontoplanen.',
    steps: [
      'Välj klient/bolag',
      'Dra och släpp dokument',
      'AI analyserar och föreslår kontering',
      'Granska och godkänn',
      'Exportera till Fortnox (kommande)'
    ],
    tips: [
      'Stöder PDF, Word, Excel och bilder',
      'Du kan korrigera AI:s förslag innan bokföring'
    ]
  },

  // Fortnox Integration
  fortnox: {
    title: 'Fortnox-integration',
    description: 'Anslut till Fortnox för att synkronisera bokföring automatiskt. Alla verifikationer skapas enligt svensk BAS-kontoplan.',
    steps: [
      'Anslut ditt Fortnox-konto (kommande)',
      'Mappa konton till BAS-kontoplanen',
      'AI föreslår konteringar automatiskt',
      'Godkänn och synka till Fortnox',
      'Verifiera i Fortnox'
    ],
    tips: [
      'Moms beräknas automatiskt',
      'Stöder svenska skatteregler'
    ]
  }
};

export default HelpTooltip;

